import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../config.dart';
import '../domain/failure.dart';
import '../domain/models.dart';
import 'backend.dart';

class FirebaseCommerceBackend implements CommerceBackend {
  FirebaseCommerceBackend(FirebaseApp app, this.mode)
    : auth = FirebaseAuth.instanceFor(app: app),
      db = FirebaseFirestore.instanceFor(app: app),
      functions = FirebaseFunctions.instanceFor(
        app: app,
        region: AppConfig.region,
      );
  @override
  final BackendMode mode;
  final FirebaseAuth auth;
  final FirebaseFirestore db;
  final FirebaseFunctions functions;
  @override
  CustomerIdentity? get currentUser => _identity(auth.currentUser);
  CustomerIdentity? _identity(User? user) =>
      user == null ? null : CustomerIdentity(user.uid, user.phoneNumber);
  @override
  Stream<CustomerIdentity?> authChanges() =>
      auth.authStateChanges().map(_identity);
  void _requireUid(String uid) {
    if (auth.currentUser?.uid != uid) throw const AppFailure('AUTH_REQUIRED');
  }

  DocumentReference<Map<String, dynamic>> _user(String uid) =>
      db.collection('users').doc(uid);
  Query<Map<String, dynamic>> _orders(String uid) => db
      .collection('orders')
      .where('uid', isEqualTo: uid)
      .orderBy('createdAt', descending: true)
      .limit(50);

  @override
  Stream<Catalogue> catalogueChanges() {
    final subscriptions = <StreamSubscription<dynamic>>[];
    DocumentSnapshot<Map<String, dynamic>>? product;
    DocumentSnapshot<Map<String, dynamic>>? settings;
    QuerySnapshot<Map<String, dynamic>>? variants;
    late StreamController<Catalogue> result;
    void emit() {
      if (product == null ||
          settings == null ||
          variants == null ||
          result.isClosed) {
        return;
      }
      try {
        result.add(
          Catalogue(
            product: product!.data()?['published'] == true
                ? Product.fromJson(product!.data())
                : null,
            variants:
                variants!.docs
                    .where((doc) => variantIds.contains(doc.id))
                    .map((doc) => Variant.fromJson(doc.id, doc.data()))
                    .toList()
                  ..sort((a, b) => a.litres.compareTo(b.litres)),
            settings: StoreSettings.fromJson(settings!.data()),
            fromCache:
                product!.metadata.isFromCache ||
                settings!.metadata.isFromCache ||
                variants!.metadata.isFromCache,
          ),
        );
      } catch (error) {
        if (!result.isClosed) result.addError(AppFailure.from(error));
      }
    }

    void fail(Object error) {
      if (!result.isClosed) result.addError(AppFailure.from(error));
    }

    result = StreamController<Catalogue>(
      onListen: () {
        subscriptions.add(
          db
              .collection('products')
              .doc('groundnut-oil')
              .snapshots(includeMetadataChanges: true)
              .listen((value) {
                product = value;
                emit();
              }, onError: fail),
        );
        subscriptions.add(
          db
              .collection('products')
              .doc('groundnut-oil')
              .collection('variants')
              .snapshots(includeMetadataChanges: true)
              .listen((value) {
                variants = value;
                emit();
              }, onError: fail),
        );
        subscriptions.add(
          db
              .collection('publicContent')
              .doc('storefront')
              .snapshots(includeMetadataChanges: true)
              .listen((value) {
                settings = value;
                emit();
              }, onError: fail),
        );
      },
      onCancel: () async {
        for (final subscription in subscriptions) {
          await subscription.cancel();
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
    // A transaction reads the current server cart before the guest merge. No
    // writes can run from a guessed empty cart during account switching.
    final cart = await db.runTransaction<List<CartLine>>((transaction) async {
      _requireUid(identity.uid);
      final ref = db.collection('carts').doc(identity.uid);
      final saved = await transaction.get(ref);
      final merged = mergeCarts(parseCart(saved.data()?['lines']), guest);
      if (guest.isNotEmpty) {
        transaction.set(ref, {
          'lines': merged.map((line) => line.toJson()).toList(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      return merged;
    });
    const server = GetOptions(source: Source.server);
    final values = await Future.wait([
      _user(identity.uid).get(server),
      _user(identity.uid).collection('addresses').doc('default').get(server),
      _user(
        identity.uid,
      ).collection('onboarding').doc('android-v1').get(server),
    ]);
    final orders = await _orders(identity.uid).get(server);
    _requireUid(identity.uid);
    return AccountSnapshot(
      profile: values[0].exists
          ? CustomerProfile.fromJson(values[0].data())
          : CustomerProfile(language: language),
      address: values[1].exists
          ? DeliveryAddress.fromJson(values[1].data())
          : null,
      guide: GuideProgress.fromJson(values[2].data()),
      cart: cart,
      orders: orders.docs
          .map((doc) => OrderRecord.fromJson(doc.data()))
          .toList(),
    );
  }

  @override
  Stream<AccountSnapshot> accountChanges(CustomerIdentity identity) {
    final subscriptions = <StreamSubscription<dynamic>>[];
    DocumentSnapshot<Map<String, dynamic>>? profile, address, guide, cart;
    QuerySnapshot<Map<String, dynamic>>? orders;
    late StreamController<AccountSnapshot> result;
    void emit() {
      if ([
            profile,
            address,
            guide,
            cart,
            orders,
          ].any((value) => value == null) ||
          result.isClosed) {
        return;
      }
      try {
        result.add(
          AccountSnapshot(
            profile: CustomerProfile.fromJson(profile!.data()),
            address: address!.exists
                ? DeliveryAddress.fromJson(address!.data())
                : null,
            guide: GuideProgress.fromJson(guide!.data()),
            cart: parseCart(cart!.data()?['lines']),
            orders: orders!.docs
                .map((doc) => OrderRecord.fromJson(doc.data()))
                .toList(),
          ),
        );
      } catch (error) {
        if (!result.isClosed) result.addError(AppFailure.from(error));
      }
    }

    void fail(Object error) {
      if (!result.isClosed) result.addError(AppFailure.from(error));
    }

    result = StreamController<AccountSnapshot>(
      onListen: () {
        final user = _user(identity.uid);
        subscriptions.add(
          user.snapshots().listen((value) {
            profile = value;
            emit();
          }, onError: fail),
        );
        subscriptions.add(
          user.collection('addresses').doc('default').snapshots().listen((
            value,
          ) {
            address = value;
            emit();
          }, onError: fail),
        );
        subscriptions.add(
          user.collection('onboarding').doc('android-v1').snapshots().listen((
            value,
          ) {
            guide = value;
            emit();
          }, onError: fail),
        );
        subscriptions.add(
          db.collection('carts').doc(identity.uid).snapshots().listen((value) {
            cart = value;
            emit();
          }, onError: fail),
        );
        subscriptions.add(
          _orders(identity.uid).snapshots().listen((value) {
            orders = value;
            emit();
          }, onError: fail),
        );
      },
      onCancel: () async {
        for (final subscription in subscriptions) {
          await subscription.cancel();
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
    return db.runTransaction((transaction) async {
      _requireUid(uid);
      final ref = db.collection('carts').doc(uid);
      final saved = await transaction.get(ref);
      final merged = applyCartEdit(
        parseCart(saved.data()?['lines']),
        before,
        lines,
        acknowledged: acknowledged,
      );
      transaction.set(ref, {
        'lines': merged.map((line) => line.toJson()).toList(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return merged;
    });
  }

  @override
  Future<void> saveAddress(String uid, DeliveryAddress address) async {
    _requireUid(uid);
    await _user(
      uid,
    ).collection('addresses').doc('default').set(address.toJson());
  }

  @override
  Future<void> saveProfile(
    CustomerIdentity identity,
    CustomerProfile profile,
  ) async {
    _requireUid(identity.uid);
    await _user(identity.uid).set({
      'displayName': profile.displayName,
      'phoneNumber': identity.phone,
      'language': profile.language,
    });
  }

  @override
  Future<void> saveGuide(String uid, GuideProgress guide) async {
    _requireUid(uid);
    await _user(
      uid,
    ).collection('onboarding').doc('android-v1').set(guide.toJson());
  }

  @override
  Future<CheckoutQuote> quote(
    List<CartLine> lines,
    DeliveryAddress address,
  ) async {
    final result = await functions
        .httpsCallable(
          'quoteCheckout',
          options: HttpsCallableOptions(timeout: const Duration(seconds: 25)),
        )
        .call({
          'lines': lines.map((line) => line.toJson()).toList(),
          'address': address.toJson(),
          'channel': 'android',
        });
    return CheckoutQuote.fromJson(result.data);
  }

  @override
  Future<String> placeCod(PendingCheckout checkout) async {
    _requireUid(checkout.uid);
    final result = await functions
        .httpsCallable(
          'placeCodOrder',
          options: HttpsCallableOptions(timeout: const Duration(seconds: 25)),
        )
        .call({
          'quoteId': checkout.quote.quoteId,
          'idempotencyKey': checkout.key,
        });
    final id = stringMap(result.data)['orderId'];
    if (id is! String || id.isEmpty) throw const AppFailure('unknown');
    return id;
  }

  @override
  Future<OrderRecord> loadOrder(String uid, String orderId) async {
    _requireUid(uid);
    final value = await db
        .collection('orders')
        .doc(orderId)
        .get(const GetOptions(source: Source.server));
    if (!value.exists || value.data()?['uid'] != uid) {
      throw const AppFailure('ORDER_NOT_FOUND');
    }
    return OrderRecord.fromJson(value.data());
  }

  @override
  Future<void> requestPhoneCode(
    String phone, {
    int? resendToken,
    required void Function(String, int?) codeSent,
    required void Function(AppFailure) failed,
    required void Function() authenticated,
    required void Function() timedOut,
    required bool Function() acceptCredential,
  }) async {
    await auth.verifyPhoneNumber(
      phoneNumber: phone,
      timeout: const Duration(seconds: 60),
      forceResendingToken: resendToken,
      verificationCompleted: (credential) async {
        if (!acceptCredential()) return;
        try {
          await auth.signInWithCredential(credential);
          authenticated();
        } catch (error) {
          failed(AppFailure.from(error));
        }
      },
      verificationFailed: (error) => failed(AppFailure.from(error)),
      codeSent: codeSent,
      codeAutoRetrievalTimeout: (_) => timedOut(),
    );
  }

  @override
  Future<void> confirmPhoneCode(String verificationId, String code) async {
    await auth.signInWithCredential(
      PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: code,
      ),
    );
  }

  @override
  Future<void> signInPreview(String phone) async =>
      throw const AppFailure('operation-not-allowed');
  @override
  Future<void> signOut() => auth.signOut();
}
