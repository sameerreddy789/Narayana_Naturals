import 'dart:async';
import 'dart:math';

import '../config.dart';
import '../domain/failure.dart';
import '../domain/models.dart';
import 'backend.dart';
import 'local_store.dart';

/// Explicit device-local preview. It initializes no Firebase services and
/// never sends SMS, collects payment, fulfills orders or handles cloud errors.
class DemoCommerceBackend implements CommerceBackend {
  DemoCommerceBackend(this.store) {
    final phone = store.read('preview-phone');
    if (phone is String && RegExp(r'^\+91[6-9][0-9]{9}$').hasMatch(phone)) {
      _user = CustomerIdentity('preview_${phone.substring(3)}', phone);
    }
  }
  final LocalStore store;
  CustomerIdentity? _user;
  final _auth = StreamController<CustomerIdentity?>.broadcast();
  final _changed = StreamController<void>.broadcast();
  final _catalogue = StreamController<void>.broadcast();
  Future<void> _mutations = Future<void>.value();
  @override
  BackendMode get mode => BackendMode.demo;
  @override
  CustomerIdentity? get currentUser => _user;
  @override
  Stream<CustomerIdentity?> authChanges() async* {
    yield _user;
    yield* _auth.stream;
  }

  // Preview stock is derived from durable, UID-scoped purchase records. The
  // order and retry key share one atomic preferences write; there is no second
  // stock or global-key write whose failure could duplicate a sample purchase.
  Map<String, int> _remainingStock() {
    final remaining = {for (final id in variantIds) id: 64};
    final prefix = store.key('account_');
    for (final key in store.preferences.getKeys().where(
      (key) => key.startsWith(prefix),
    )) {
      final data = stringMap(store.read(key.substring(store.key('').length)));
      final orders = data['orders'] is List ? data['orders'] as List : [];
      for (final value in orders) {
        final order = OrderRecord.fromJson(value);
        if (order.status == 'cancelled') continue;
        for (final line in order.lines) {
          if (remaining.containsKey(line.id)) {
            remaining[line.id] = max(0, remaining[line.id]! - line.quantity);
          }
        }
      }
    }
    return remaining;
  }

  Catalogue _catalogueValue() {
    final stock = _remainingStock();
    return Catalogue(
      product: const Product(
        name: Bilingual(
          'Wooden Ghani groundnut oil',
          'చెక్క గానుగ వేరుశెనగ నూనె',
        ),
        description: Bilingual(
          'Groundnut oil made with Narayana Naturals’ bull-driven wooden Ghani process.',
          'నారాయణ నేచురల్స్ ఎద్దుతో నడిచే చెక్క గానుగ పద్ధతిలో తయారైన వేరుశెనగ నూనె.',
        ),
        ingredients: Bilingual(
          'Groundnuts. Contains groundnut allergens.',
          'వేరుశెనగలు. వేరుశెనగ అలెర్జీ ఉన్నవారు గమనించండి.',
        ),
        extraction: Bilingual(
          'Bull-driven wooden Ghani extraction.',
          'ఎద్దుతో నడిచే చెక్క గానుగ వెలికితీత.',
        ),
        storage: Bilingual(
          'Preview information: check the delivered pack label for storage and best-before instructions.',
          'ప్రివ్యూ సమాచారం: నిల్వ, గడువు సూచనల కోసం ప్యాక్ లేబుల్‌ను చూడండి.',
        ),
      ),
      variants: [
        Variant(
          id: '1l',
          litres: 1,
          pricePaise: 45000,
          stock: stock['1l']!,
          enabled: true,
        ),
        Variant(
          id: '2l',
          litres: 2,
          pricePaise: 90000,
          stock: stock['2l']!,
          enabled: true,
        ),
        Variant(
          id: '5l',
          litres: 5,
          pricePaise: 225000,
          stock: stock['5l']!,
          enabled: true,
        ),
      ],
      settings: const StoreSettings(
        orderingEnabled: true,
        preview: true,
        notice: Bilingual(
          'Preview only — sample prices and delivery. No real order or payment.',
          'ప్రివ్యూ మాత్రమే — నమూనా ధరలు, డెలివరీ. నిజమైన ఆర్డర్ లేదా చెల్లింపు లేదు.',
        ),
      ),
    );
  }

  @override
  Stream<Catalogue> catalogueChanges() async* {
    yield _catalogueValue();
    yield* _catalogue.stream.map((_) => _catalogueValue());
  }

  void _require(String uid) {
    if (_user?.uid != uid) throw const AppFailure('AUTH_REQUIRED');
  }

  Map<String, dynamic> _data(String uid) =>
      stringMap(store.read('account_$uid'));
  AccountSnapshot _snapshot(String uid, [String language = 'en']) {
    final data = _data(uid);
    final orders =
        (data['orders'] is List ? data['orders'] as List : [])
            .map(OrderRecord.fromJson)
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return AccountSnapshot(
      profile: data['profile'] == null
          ? CustomerProfile(language: language)
          : CustomerProfile.fromJson(data['profile']),
      cart: parseCart(data['cart']),
      address: data['address'] == null
          ? null
          : DeliveryAddress.fromJson(data['address']),
      guide: GuideProgress.fromJson(data['guide']),
      orders: orders.take(50).toList(),
    );
  }

  Future<T> _mutate<T>(
    String uid,
    Future<T> Function(Map<String, dynamic>) action,
  ) {
    final operation = _mutations.catchError((_) {}).then((_) async {
      _require(uid);
      return action(_data(uid));
    });
    _mutations = operation.then<void>((_) {}).catchError((_) {});
    return operation;
  }

  Future<void> _persist(String uid, Map<String, dynamic> data) async {
    _require(uid);
    await store.write('account_$uid', data);
    _changed.add(null);
    _catalogue.add(null);
  }

  @override
  Future<AccountSnapshot> hydrate(
    CustomerIdentity identity,
    List<CartLine> guest,
    String language,
  ) => _mutate(identity.uid, (data) async {
    if (guest.isNotEmpty) {
      data['cart'] = mergeCarts(
        parseCart(data['cart']),
        guest,
      ).map((line) => line.toJson()).toList();
      await _persist(identity.uid, data);
    }
    return _snapshot(identity.uid, language);
  });
  @override
  Stream<AccountSnapshot> accountChanges(CustomerIdentity identity) async* {
    yield _snapshot(identity.uid);
    yield* _changed.stream.map((_) => _snapshot(identity.uid));
  }

  @override
  Future<List<CartLine>> saveCart(
    String uid,
    List<CartLine> lines,
    List<CartLine> before, {
    List<CartLine>? acknowledged,
  }) => _mutate(uid, (data) async {
    final merged = applyCartEdit(
      parseCart(data['cart']),
      before,
      lines,
      acknowledged: acknowledged,
    );
    data['cart'] = merged.map((line) => line.toJson()).toList();
    await _persist(uid, data);
    return merged;
  });
  @override
  Future<void> saveAddress(String uid, DeliveryAddress address) =>
      _mutate(uid, (data) async {
        data['address'] = address.toJson();
        await _persist(uid, data);
      });
  @override
  Future<void> saveProfile(
    CustomerIdentity identity,
    CustomerProfile profile,
  ) => _mutate(identity.uid, (data) async {
    data['profile'] = {
      'displayName': profile.displayName,
      'language': profile.language,
    };
    await _persist(identity.uid, data);
  });
  @override
  Future<void> saveGuide(String uid, GuideProgress guide) =>
      _mutate(uid, (data) async {
        data['guide'] = guide.toJson();
        await _persist(uid, data);
      });
  @override
  Future<CheckoutQuote> quote(
    List<CartLine> lines,
    DeliveryAddress address,
  ) async {
    final identity = _user;
    if (identity == null) throw const AppFailure('AUTH_REQUIRED');
    if (!address.valid || lines.isEmpty) {
      throw const AppFailure('INVALID_INPUT');
    }
    if (!{'517001', '517501', '560001'}.contains(address.pin)) {
      throw const AppFailure('NOT_SERVICEABLE');
    }
    final catalogue = _catalogueValue();
    final quoted = <OrderLine>[];
    for (final line in lines) {
      final variant = catalogue.variant(line.id);
      if (variant == null ||
          !variant.available ||
          variant.stock < line.quantity) {
        throw const AppFailure('OUT_OF_STOCK');
      }
      quoted.add(
        OrderLine(
          id: line.id,
          quantity: line.quantity,
          litres: variant.litres,
          unitPricePaise: variant.pricePaise,
        ),
      );
    }
    final subtotal = quoted.fold(0, (total, line) => total + line.totalPaise);
    final litres = quoted.fold(
      0,
      (total, line) => total + line.litres * line.quantity,
    );
    final courier = address.pin == '560001';
    final shipping = courier ? 9000 + max(0, litres - 2) * 1500 : 3000;
    final quote = CheckoutQuote(
      quoteId: 'preview_quote_${DateTime.now().microsecondsSinceEpoch}',
      subtotalPaise: subtotal,
      shippingPaise: shipping,
      totalPaise: subtotal + shipping,
      codAllowed: true,
      estimate: courier ? 'Preview: 4–7 days' : 'Preview: 2–4 days',
      expiresAt: DateTime.now().toUtc().add(const Duration(minutes: 10)),
      preview: true,
      lines: quoted,
    );
    final quotes = stringMap(store.read('preview-quotes'));
    quotes[quote.quoteId] = {
      'uid': identity.uid,
      'quote': quote.toJson(),
      'address': address.toJson(),
    };
    await store.write('preview-quotes', quotes);
    return quote;
  }

  @override
  Future<String> placeCod(PendingCheckout checkout) =>
      _mutate(checkout.uid, (data) async {
        final keys = stringMap(data['keys']);
        final previous = stringMap(keys[checkout.key]);
        if (previous.isNotEmpty) {
          if (previous['quoteId'] != checkout.quote.quoteId) {
            throw const AppFailure('IDEMPOTENCY_CONFLICT');
          }
          return previous['orderId'].toString();
        }
        final usedQuotes = stringMap(data['quoteOrders']);
        if (usedQuotes[checkout.quote.quoteId] is String) {
          return usedQuotes[checkout.quote.quoteId] as String;
        }
        final saved = stringMap(
          stringMap(store.read('preview-quotes'))[checkout.quote.quoteId],
        );
        if (saved.isEmpty) throw const AppFailure('QUOTE_NOT_FOUND');
        if (saved['uid'] != checkout.uid) {
          throw const AppFailure('QUOTE_OWNER_MISMATCH');
        }
        final quote = CheckoutQuote.fromJson(saved['quote']);
        if (quote.expired) throw const AppFailure('QUOTE_EXPIRED');
        final stock = _remainingStock();
        for (final line in quote.lines) {
          if ((stock[line.id] ?? 0) < line.quantity) {
            throw const AppFailure('OUT_OF_STOCK');
          }
        }
        final id = 'PREVIEW-${DateTime.now().microsecondsSinceEpoch}';
        final order = OrderRecord(
          id: id,
          uid: checkout.uid,
          createdAt: DateTime.now().toUtc(),
          lines: quote.lines,
          address: DeliveryAddress.fromJson(saved['address']),
          subtotalPaise: quote.subtotalPaise,
          shippingPaise: quote.shippingPaise,
          totalPaise: quote.totalPaise,
          status: 'received',
          paymentStatus: 'pending_collection',
          channel: 'android',
          preview: true,
        );
        data['orders'] = [
          order.toJson(),
          ...(data['orders'] is List ? data['orders'] as List : []),
        ];
        keys[checkout.key] = {'quoteId': quote.quoteId, 'orderId': id};
        data['keys'] = keys;
        usedQuotes[quote.quoteId] = id;
        data['quoteOrders'] = usedQuotes;
        await _persist(checkout.uid, data);
        return id;
      });
  @override
  Future<OrderRecord> loadOrder(String uid, String orderId) async {
    _require(uid);
    for (final order in _snapshot(uid).orders) {
      if (order.id == orderId) return order;
    }
    throw const AppFailure('ORDER_NOT_FOUND');
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
  }) async => throw const AppFailure('operation-not-allowed');
  @override
  Future<void> confirmPhoneCode(String verificationId, String code) async =>
      throw const AppFailure('operation-not-allowed');
  @override
  Future<void> signInPreview(String phone) async {
    if (!RegExp(r'^\+91[6-9][0-9]{9}$').hasMatch(phone)) {
      throw const AppFailure('invalid-phone-number');
    }
    await store.write('preview-phone', phone);
    _user = CustomerIdentity('preview_${phone.substring(3)}', phone);
    _auth.add(_user);
  }

  @override
  Future<void> signOut() async {
    await store.write('preview-phone', null);
    _user = null;
    _auth.add(null);
  }
}
