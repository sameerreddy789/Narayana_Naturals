import 'dart:async';
import 'dart:convert';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config.dart';
import '../domain/failure.dart';
import '../domain/models.dart';
import 'backend.dart';

class FirebaseCommerceBackend implements CommerceBackend {
  FirebaseCommerceBackend(this.app, this.config)
    : auth = FirebaseAuth.instanceFor(app: app),
      db = FirebaseDatabase.instanceFor(
        app: app,
        databaseURL: config.databaseUrl,
      );
  final FirebaseApp app;
  final AppConfig config;
  @override
  BackendMode get mode => config.mode;
  @override
  bool get privateDraft => config.privateDraft;
  final FirebaseAuth auth;
  final FirebaseDatabase db;
  @override
  CustomerIdentity? get currentUser => _identity(auth.currentUser);
  CustomerIdentity? _identity(User? user) =>
      user == null ? null : CustomerIdentity(user.uid, user.email);
  @override
  Stream<CustomerIdentity?> authChanges() =>
      auth.authStateChanges().map(_identity);
  void _requireUid(String uid) {
    if (auth.currentUser?.uid != uid) throw const AppFailure('AUTH_REQUIRED');
  }

  AppFailure _failure(Object error) {
    final failure = AppFailure.from(error);
    return privateDraft && failure.code == 'permission-denied'
        ? const AppFailure('TESTER_REQUIRED')
        : failure;
  }

  Future<void> _connected() async {
    await db
        .ref('.info/connected')
        .onValue
        .firstWhere((event) => event.snapshot.value == true)
        .timeout(const Duration(seconds: 15));
  }

  Future<DataSnapshot> _read(Query query) async {
    var stage = 'connect';
    try {
      await _connected();
      stage = 'query';
      final result = await query.get().timeout(const Duration(seconds: 15));
      stage = 'connection-check';
      // Native listeners may initially emit false while they attach. Wait
      // for a confirmed connection instead of treating that first event as
      // a failure after an otherwise successful server read.
      await _connected();
      return result;
    } catch (error) {
      if (config.mode == BackendMode.emulator && AppConfig.internalBuild) {
        final code = error is FirebaseException
            ? error.code
            : error.runtimeType;
        debugPrint('NN_RTDB_READ_ERROR stage=$stage code=$code');
      }
      throw _failure(error);
    }
  }

  Query _orders(String uid) => db
      .ref('${config.commerceRoot}/ordersByUser/$uid')
      .orderByChild('createdAt')
      .limitToLast(50);

  Future<bool> _canReadOrderHistory(String uid) async {
    _requireUid(uid);
    if (!privateDraft) return true;
    final claims = (await auth.currentUser!.getIdTokenResult()).claims;
    _requireUid(uid);
    return claims?['admin'] == true || claims?['tester'] == true;
  }

  List<OrderRecord> _parseOrders(DataSnapshot snapshot) =>
      snapshot.children
          .map((value) => OrderRecord.fromJson(value.value))
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  @override
  Stream<Catalogue> catalogueChanges() {
    final subscriptions = <StreamSubscription<DatabaseEvent>>[];
    final values = <String, Object?>{};
    bool connected = false;
    late StreamController<Catalogue> result;
    void emit() {
      if (result.isClosed ||
          !['product', 'variants', 'settings'].every(values.containsKey)) {
        return;
      }
      final product = stringMap(values['product']);
      final variants = stringMap(values['variants']);
      final settings = StoreSettings.fromJson(values['settings']);
      if (settings.preview && !privateDraft) {
        result.addError(const AppFailure('STORE_NOT_READY'));
        return;
      }
      result.add(
        Catalogue(
          product: product['published'] == true
              ? Product.fromJson(product)
              : null,
          variants:
              variants.entries
                  .where((entry) => variantIds.contains(entry.key))
                  .map((entry) => Variant.fromJson(entry.key, entry.value))
                  .toList()
                ..sort((a, b) => a.litres.compareTo(b.litres)),
          settings: settings,
          fromCache: !connected,
        ),
      );
    }

    void failure(Object error) {
      if (!result.isClosed) result.addError(_failure(error));
    }

    result = StreamController<Catalogue>(
      onListen: () {
        subscriptions.add(
          db.ref('.info/connected').onValue.listen((event) {
            connected = event.snapshot.value == true;
            emit();
          }, onError: failure),
        );
        for (final entry in {
          'product': '${config.commerceRoot}/products/groundnut-oil',
          'variants': '${config.commerceRoot}/variants',
          'settings': '${config.commerceRoot}/publicContent/storefront',
        }.entries) {
          subscriptions.add(
            db.ref(entry.value).onValue.listen((event) {
              values[entry.key] = event.snapshot.value;
              emit();
            }, onError: failure),
          );
        }
      },
      onCancel: () async {
        for (final sub in subscriptions) {
          await sub.cancel();
        }
      },
    );
    return result.stream;
  }

  @override
  Future<AccountSnapshot> hydrate(
    CustomerIdentity identity,
    List<CartLine> guest,
    String language,
  ) async {
    _requireUid(identity.uid);
    await _connected();
    final cartRef = db.ref('carts/${identity.uid}');
    List<CartLine> cart;
    if (guest.isNotEmpty) {
      final transaction = await cartRef.runTransaction((value) {
        _requireUid(identity.uid);
        final merged = mergeCarts(parseCart(stringMap(value)['lines']), guest);
        return Transaction.success({
          'lines': merged.map((line) => line.toJson()).toList(),
          'updatedAt': ServerValue.timestamp,
        });
      }, applyLocally: false);
      if (!transaction.committed) throw const AppFailure('unavailable');
      cart = parseCart(stringMap(transaction.snapshot.value)['lines']);
    } else {
      cart = parseCart(stringMap((await _read(cartRef)).value)['lines']);
    }
    final uid = identity.uid;
    // Registration grants access to personal data. Private order history
    // requires a separately assigned tester/owner role; it must not block
    // a new customer's profile, address, cart or first-use guide.
    final canReadOrders = await _canReadOrderHistory(uid);
    final values = await Future.wait([
      _read(db.ref('users/$uid/profile')),
      _read(db.ref('users/$uid/addresses/default')),
      _read(db.ref('users/$uid/onboarding/android-v1')),
      if (canReadOrders) _read(_orders(uid)),
    ]);
    _requireUid(uid);
    return AccountSnapshot(
      profile: values[0].exists
          ? CustomerProfile.fromJson(values[0].value)
          : CustomerProfile(language: language),
      address: values[1].exists
          ? DeliveryAddress.fromJson(values[1].value)
          : null,
      guide: GuideProgress.fromJson(values[2].value),
      cart: cart,
      orders: canReadOrders ? _parseOrders(values[3]) : const [],
    );
  }

  @override
  Stream<AccountSnapshot> accountChanges(CustomerIdentity identity) {
    final subscriptions = <StreamSubscription<DatabaseEvent>>[];
    final values = <String, DataSnapshot>{};
    var canReadOrders = false;
    var cancelled = false;
    late StreamController<AccountSnapshot> result;
    void failure(Object error) {
      if (!result.isClosed) result.addError(_failure(error));
    }

    void emit() {
      if (result.isClosed ||
          ![
            'profile',
            'address',
            'guide',
            'cart',
            if (canReadOrders) 'orders',
          ].every(values.containsKey)) {
        return;
      }
      try {
        _requireUid(identity.uid);
        result.add(
          AccountSnapshot(
            profile: CustomerProfile.fromJson(values['profile']!.value),
            address: values['address']!.exists
                ? DeliveryAddress.fromJson(values['address']!.value)
                : null,
            guide: GuideProgress.fromJson(values['guide']!.value),
            cart: parseCart(stringMap(values['cart']!.value)['lines']),
            orders: canReadOrders ? _parseOrders(values['orders']!) : const [],
          ),
        );
      } catch (error) {
        failure(error);
      }
    }

    final uid = identity.uid;
    result = StreamController<AccountSnapshot>(
      onListen: () async {
        try {
          canReadOrders = await _canReadOrderHistory(uid);
          if (cancelled) return;
          for (final entry in <String, Query>{
            'profile': db.ref('users/$uid/profile'),
            'address': db.ref('users/$uid/addresses/default'),
            'guide': db.ref('users/$uid/onboarding/android-v1'),
            'cart': db.ref('carts/$uid'),
            if (canReadOrders) 'orders': _orders(uid),
          }.entries) {
            subscriptions.add(
              entry.value.onValue.listen((event) {
                values[entry.key] = event.snapshot;
                emit();
              }, onError: failure),
            );
          }
        } catch (error) {
          if (!cancelled) failure(error);
        }
      },
      onCancel: () async {
        cancelled = true;
        for (final sub in subscriptions) {
          await sub.cancel();
        }
      },
    );
    return result.stream;
  }

  @override
  Future<List<CartLine>> saveCart(
    String uid,
    List<CartLine> lines,
    List<CartLine> before, {
    List<CartLine>? acknowledged,
  }) async {
    _requireUid(uid);
    await _connected();
    final result = await db.ref('carts/$uid').runTransaction((value) {
      _requireUid(uid);
      final merged = applyCartEdit(
        parseCart(stringMap(value)['lines']),
        before,
        lines,
        acknowledged: acknowledged,
      );
      return Transaction.success({
        'lines': merged.map((line) => line.toJson()).toList(),
        'updatedAt': ServerValue.timestamp,
      });
    }, applyLocally: false);
    if (!result.committed) throw const AppFailure('unavailable');
    return parseCart(stringMap(result.snapshot.value)['lines']);
  }

  @override
  Future<void> saveAddress(String uid, DeliveryAddress address) async {
    _requireUid(uid);
    await _connected();
    await db.ref('users/$uid/addresses/default').set(address.toJson());
  }

  @override
  Future<void> saveProfile(
    CustomerIdentity identity,
    CustomerProfile profile,
  ) async {
    _requireUid(identity.uid);
    await _connected();
    await db.ref('users/${identity.uid}/profile').set({
      'displayName': profile.displayName,
      'email': identity.email,
      'language': profile.language,
    });
  }

  @override
  Future<void> saveGuide(String uid, GuideProgress guide) async {
    _requireUid(uid);
    await _connected();
    final result = await db
        .ref('users/$uid/onboarding/android-v1')
        .runTransaction((value) {
          _requireUid(uid);
          final previous = GuideProgress.fromJson(value);
          final replay =
              !guide.welcomeSeen &&
              !guide.skipped &&
              guide.dismissedPages.isEmpty;
          return Transaction.success(
            GuideProgress(
              welcomeSeen: guide.welcomeSeen,
              skipped: guide.skipped,
              dismissedPages: replay
                  ? []
                  : {
                      ...previous.dismissedPages,
                      ...guide.dismissedPages,
                    }.toList(),
            ).toJson(),
          );
        }, applyLocally: false);
    if (!result.committed) throw const AppFailure('unavailable');
  }

  Future<Object?> _api(String method, Object data) async {
    config.validate();
    final user = auth.currentUser;
    if (user == null) throw const AppFailure('AUTH_REQUIRED');
    final base = config.apiUri.toString().replaceFirst(RegExp(r'/$'), '');
    final idToken = await user.getIdToken();
    if (idToken == null || idToken.isEmpty) {
      throw const AppFailure('AUTH_REQUIRED');
    }
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $idToken',
    };
    if (mode == BackendMode.firebase) {
      try {
        final token = await FirebaseAppCheck.instanceFor(app: app).getToken();
        if (token == null || token.isEmpty) {
          throw const AppFailure('APP_CHECK_REQUIRED');
        }
        headers['X-Firebase-AppCheck'] = token;
      } catch (_) {
        throw const AppFailure('APP_CHECK_REQUIRED');
      }
    }
    try {
      final response = await http
          .post(
            Uri.parse('$base/v1/$method'),
            headers: headers,
            body: jsonEncode({'data': data}),
          )
          .timeout(const Duration(seconds: 25));
      Object? decoded;
      try {
        decoded = jsonDecode(response.body);
      } catch (_) {
        throw const AppFailure('unavailable');
      }
      final body = stringMap(decoded);
      if (response.statusCode != 200 || body.containsKey('error')) {
        throw AppFailure.fromApi(body);
      }
      if (!body.containsKey('data')) throw const AppFailure('unknown');
      return body['data'];
    } catch (error) {
      throw AppFailure.from(error);
    }
  }

  @override
  Future<CheckoutQuote> quote(
    List<CartLine> lines,
    DeliveryAddress address,
  ) async {
    final quote = CheckoutQuote.fromJson(
      await _api('quoteCheckout', {
        'lines': lines.map((line) => line.toJson()).toList(),
        'address': address.toJson(),
        'channel': 'android',
      }),
    );
    if (quote.preview && !privateDraft) {
      throw const AppFailure('STORE_NOT_READY');
    }
    return quote;
  }

  @override
  Future<String> placeCod(PendingCheckout checkout) async {
    _requireUid(checkout.uid);
    if (privateDraft || checkout.quote.preview) {
      throw const AppFailure('STORE_NOT_READY');
    }
    final id = stringMap(
      await _api('placeCodOrder', {
        'quoteId': checkout.quote.quoteId,
        'idempotencyKey': checkout.key,
      }),
    )['orderId'];
    if (id is! String || id.isEmpty) throw const AppFailure('unknown');
    return id;
  }

  @override
  Future<OrderRecord> loadOrder(String uid, String orderId) async {
    _requireUid(uid);
    if (!RegExp(r'^[A-Za-z0-9_-]{8,128}$').hasMatch(orderId)) {
      throw const AppFailure('ORDER_NOT_FOUND');
    }
    final value = await _read(
      db.ref('${config.commerceRoot}/ordersByUser/$uid/$orderId'),
    );
    if (!value.exists || stringMap(value.value)['uid'] != uid) {
      throw const AppFailure('ORDER_NOT_FOUND');
    }
    final order = OrderRecord.fromJson(value.value);
    if (order.preview && !privateDraft) {
      throw const AppFailure('STORE_NOT_READY');
    }
    return order;
  }

  @override
  Future<void> signInEmail(
    String email,
    String password, {
    String? name,
    bool createAccount = false,
    String language = 'en',
  }) async {
    final normalized = email.trim().toLowerCase();
    if (createAccount) {
      final credential = await auth.createUserWithEmailAndPassword(
        email: normalized,
        password: password,
      );
      final user = credential.user!;
      await user.updateDisplayName(name?.trim() ?? '');
      await saveProfile(
        CustomerIdentity(user.uid, user.email),
        CustomerProfile(displayName: name?.trim() ?? '', language: language),
      );
    } else {
      await auth.signInWithEmailAndPassword(
        email: normalized,
        password: password,
      );
    }
  }

  @override
  Future<void> resetPassword(String email) =>
      auth.sendPasswordResetEmail(email: email.trim().toLowerCase());
  @override
  Future<void> signOut() => auth.signOut();
}
