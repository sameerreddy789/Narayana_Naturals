import 'dart:math' as math;

import 'package:intl/intl.dart';

const variantIds = ['1l', '2l', '5l'];

Map<String, dynamic> stringMap(Object? value) => value is Map
    ? value.map((key, value) => MapEntry(key.toString(), value))
    : <String, dynamic>{};

int intValue(Object? value, [int fallback = 0]) =>
    value is num && value.isFinite ? value.toInt() : fallback;

DateTime dateValue(Object? value) {
  if (value is int && value >= 0 && value <= 8640000000000000) {
    return DateTime.fromMillisecondsSinceEpoch(value, isUtc: true);
  }
  return DateTime.tryParse(value?.toString() ?? '') ??
      DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
}

String money(int paise) => NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: paise % 100 == 0 ? 0 : 2,
).format(paise / 100);

class Bilingual {
  const Bilingual(this.en, this.te);
  factory Bilingual.fromJson(Object? value) {
    final data = stringMap(value);
    return Bilingual(
      data['en']?.toString() ?? '',
      data['te']?.toString() ?? '',
    );
  }
  final String en;
  final String te;
  String inLanguage(String language) =>
      language == 'te' && te.isNotEmpty ? te : en;
}

class Variant {
  const Variant({
    required this.id,
    required this.litres,
    required this.pricePaise,
    required this.stock,
    required this.enabled,
    this.stockConfirmed = true,
  });
  factory Variant.fromJson(String id, Object? value) {
    final data = stringMap(value);
    return Variant(
      id: id,
      litres: intValue(data['litres']),
      pricePaise: intValue(data['pricePaise']),
      stock: intValue(data['stock']),
      enabled: data['enabled'] == true,
      stockConfirmed: data['stockConfirmed'] != false,
    );
  }
  final String id;
  final int litres;
  final int pricePaise;
  final int stock;
  final bool enabled;
  final bool stockConfirmed;
  bool get available =>
      enabled && stockConfirmed && stock > 0 && pricePaise > 0;
  int get quantityLimit =>
      stockConfirmed ? math.min(20, math.max(0, stock)) : 0;
  Variant withStock(int value) => Variant(
    id: id,
    litres: litres,
    pricePaise: pricePaise,
    stock: value,
    enabled: enabled,
    stockConfirmed: stockConfirmed,
  );
}

class Product {
  const Product({
    required this.name,
    required this.description,
    required this.ingredients,
    required this.extraction,
    required this.storage,
  });
  factory Product.fromJson(Object? value) {
    final data = stringMap(value);
    return Product(
      name: Bilingual.fromJson(data['name']),
      description: Bilingual.fromJson(data['description']),
      ingredients: Bilingual.fromJson(data['ingredients']),
      extraction: Bilingual.fromJson(data['extraction']),
      storage: Bilingual.fromJson(data['storage']),
    );
  }
  final Bilingual name;
  final Bilingual description;
  final Bilingual ingredients;
  final Bilingual extraction;
  final Bilingual storage;
}

class StoreSettings {
  const StoreSettings({
    this.orderingEnabled = false,
    this.preview = false,
    this.supportPhone,
    this.notice = const Bilingual('', ''),
  });
  factory StoreSettings.fromJson(Object? value) {
    final data = stringMap(value);
    return StoreSettings(
      orderingEnabled: data['orderingEnabled'] == true,
      preview: data['preview'] == true,
      supportPhone: data['supportPhone']?.toString(),
      notice: Bilingual.fromJson(data['notice']),
    );
  }
  final bool orderingEnabled;
  final bool preview;
  final String? supportPhone;
  final Bilingual notice;
}

class Catalogue {
  const Catalogue({
    this.product,
    this.variants = const [],
    this.settings = const StoreSettings(),
    this.fromCache = false,
  });
  final Product? product;
  final List<Variant> variants;
  final StoreSettings settings;
  final bool fromCache;
  Variant? variant(String id) {
    for (final value in variants) {
      if (value.id == id) return value;
    }
    return null;
  }

  bool get published => product != null;
}

class CartLine {
  const CartLine(this.id, this.quantity);
  final String id;
  final int quantity;
  Map<String, Object> toJson() => {'id': id, 'quantity': quantity};
  @override
  bool operator ==(Object other) =>
      other is CartLine && other.id == id && other.quantity == quantity;
  @override
  int get hashCode => Object.hash(id, quantity);
}

List<CartLine> parseCart(Object? value) {
  if (value is! List) return [];
  final quantities = <String, int>{};
  for (final item in value) {
    final data = stringMap(item);
    final id = data['id']?.toString() ?? '';
    final quantity = intValue(data['quantity']);
    if (variantIds.contains(id) && quantity > 0) {
      quantities[id] = math.min(20, quantity);
    }
  }
  return variantIds
      .where(quantities.containsKey)
      .map((id) => CartLine(id, quantities[id]!))
      .toList();
}

/// Retrying guest hydration must not add the guest cart twice. The larger
/// quantity wins for a shared pack; different pack sizes are combined.
List<CartLine> mergeCarts(List<CartLine> remote, List<CartLine> guest) {
  final quantities = <String, int>{};
  for (final item in [...remote, ...guest]) {
    if (!variantIds.contains(item.id) || item.quantity <= 0) continue;
    quantities[item.id] = math.min(
      20,
      math.max(quantities[item.id] ?? 0, item.quantity),
    );
  }
  return variantIds
      .where(quantities.containsKey)
      .map((id) => CartLine(id, quantities[id]!))
      .toList();
}

/// A customer may edit the cart while an order response is uncertain. Only
/// remove the unchanged purchased lines, so later edits remain visible.
List<CartLine> clearPurchasedLines(
  List<CartLine> current,
  List<CartLine> purchased,
) => current.where((line) => !purchased.contains(line)).toList();

/// Apply only variants the customer edited. Newer unrelated packs survive.
/// Repeating an ambiguous write cannot add its quantity twice. Conflicting
/// decreases retain the newer saved quantity for the customer to review.
List<CartLine> applyCartEdit(
  List<CartLine> remote,
  List<CartLine> before,
  List<CartLine> desired, {
  List<CartLine>? acknowledged,
}) {
  final current = {for (final line in remote) line.id: line.quantity};
  final base = {for (final line in before) line.id: line.quantity};
  final next = {for (final line in desired) line.id: line.quantity};
  final synced = acknowledged == null
      ? null
      : {for (final line in acknowledged) line.id: line.quantity};
  for (final id in variantIds) {
    final old = base[id] ?? 0, value = next[id] ?? 0, saved = current[id] ?? 0;
    if (old == value && (synced == null || (synced[id] ?? 0) == value)) {
      continue;
    }
    if (saved == old ||
        saved == value ||
        (synced != null && saved == (synced[id] ?? 0))) {
      if (value == 0) {
        current.remove(id);
      } else {
        current[id] = value;
      }
    } else if (value > old) {
      current[id] = math.min(20, math.max(saved, value));
    }
  }
  return variantIds
      .where((id) => (current[id] ?? 0) > 0)
      .map((id) => CartLine(id, current[id]!))
      .toList();
}

class DeliveryAddress {
  const DeliveryAddress({
    required this.name,
    required this.phone,
    required this.street,
    required this.city,
    required this.pin,
  });
  factory DeliveryAddress.fromJson(Object? value) {
    final data = stringMap(value);
    return DeliveryAddress(
      name: data['name']?.toString() ?? '',
      phone: data['phone']?.toString() ?? '',
      street: data['street']?.toString() ?? '',
      city: data['city']?.toString() ?? '',
      pin: data['pin']?.toString() ?? '',
    );
  }
  final String name;
  final String phone;
  final String street;
  final String city;
  final String pin;
  Map<String, String> toJson() => {
    'name': name,
    'phone': phone,
    'street': street,
    'city': city,
    'pin': pin,
  };
  bool get valid =>
      name.trim().length >= 2 &&
      name.length <= 100 &&
      RegExp(r'^[6-9][0-9]{9}$').hasMatch(phone) &&
      street.trim().length >= 5 &&
      street.length <= 300 &&
      city.trim().length >= 2 &&
      city.length <= 100 &&
      RegExp(r'^[1-9][0-9]{5}$').hasMatch(pin);
  String get summary => '$street\n$city — $pin';
}

class CustomerIdentity {
  const CustomerIdentity(this.uid, this.email);
  final String uid;
  final String? email;
  bool get emailAccount =>
      RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email ?? '');
}

class CustomerProfile {
  const CustomerProfile({this.displayName = '', this.language = 'en'});
  factory CustomerProfile.fromJson(Object? value) {
    final data = stringMap(value);
    return CustomerProfile(
      displayName: data['displayName']?.toString() ?? '',
      language: data['language'] == 'te' ? 'te' : 'en',
    );
  }
  final String displayName;
  final String language;
}

class GuideProgress {
  const GuideProgress({
    this.welcomeSeen = false,
    this.skipped = false,
    this.dismissedPages = const [],
  });
  factory GuideProgress.fromJson(Object? value) {
    final data = stringMap(value);
    return GuideProgress(
      welcomeSeen: data['welcomeSeen'] == true,
      skipped: data['skipped'] == true,
      dismissedPages: data['dismissedPages'] is List
          ? (data['dismissedPages'] as List)
                .whereType<String>()
                .take(20)
                .toList()
          : [],
    );
  }
  final bool welcomeSeen;
  final bool skipped;
  final List<String> dismissedPages;
  bool shouldShow(String page) =>
      welcomeSeen && !skipped && !dismissedPages.contains(page);
  GuideProgress welcome({required bool skip}) => GuideProgress(
    welcomeSeen: true,
    skipped: skip,
    dismissedPages: dismissedPages,
  );
  GuideProgress dismiss(String page) => GuideProgress(
    welcomeSeen: welcomeSeen,
    skipped: skipped,
    dismissedPages: {...dismissedPages, page}.toList(),
  );
  Map<String, Object> toJson() => {
    'welcomeSeen': welcomeSeen,
    'skipped': skipped,
    'dismissedPages': dismissedPages,
  };
}

class OrderLine {
  const OrderLine({
    required this.id,
    required this.quantity,
    required this.litres,
    required this.unitPricePaise,
  });
  factory OrderLine.fromJson(Object? value) {
    final data = stringMap(value);
    return OrderLine(
      id: data['id']?.toString() ?? '',
      quantity: intValue(data['quantity']),
      litres: intValue(data['litres']),
      unitPricePaise: intValue(data['unitPricePaise']),
    );
  }
  final String id;
  final int quantity;
  final int litres;
  final int unitPricePaise;
  int get totalPaise => quantity * unitPricePaise;
  Map<String, Object> toJson() => {
    'id': id,
    'quantity': quantity,
    'litres': litres,
    'unitPricePaise': unitPricePaise,
  };
}

class CheckoutQuote {
  const CheckoutQuote({
    required this.quoteId,
    required this.subtotalPaise,
    required this.shippingPaise,
    required this.totalPaise,
    required this.codAllowed,
    required this.estimate,
    required this.expiresAt,
    required this.preview,
    required this.lines,
  });
  factory CheckoutQuote.fromJson(Object? value) {
    final data = stringMap(value);
    return CheckoutQuote(
      quoteId: data['quoteId']?.toString() ?? '',
      subtotalPaise: intValue(data['subtotalPaise']),
      shippingPaise: intValue(data['shippingPaise']),
      totalPaise: intValue(data['totalPaise']),
      codAllowed: data['codAllowed'] == true,
      estimate: data['estimate']?.toString() ?? '',
      expiresAt: dateValue(data['expiresAt']),
      preview: data['preview'] == true,
      lines: (data['lines'] is List ? data['lines'] as List : [])
          .map(OrderLine.fromJson)
          .toList(),
    );
  }
  final String quoteId;
  final int subtotalPaise;
  final int shippingPaise;
  final int totalPaise;
  final bool codAllowed;
  final String estimate;
  final DateTime expiresAt;
  final bool preview;
  final List<OrderLine> lines;
  bool get localDemo => preview && quoteId.startsWith('demo_quote_');
  bool get expired => !DateTime.now().isBefore(expiresAt);
  Map<String, Object> toJson() => {
    'quoteId': quoteId,
    'subtotalPaise': subtotalPaise,
    'shippingPaise': shippingPaise,
    'totalPaise': totalPaise,
    'codAllowed': codAllowed,
    'estimate': estimate,
    'expiresAt': expiresAt.toUtc().toIso8601String(),
    'preview': preview,
    'lines': lines.map((line) => line.toJson()).toList(),
  };
}

class OrderRecord {
  const OrderRecord({
    required this.id,
    required this.uid,
    required this.createdAt,
    required this.lines,
    required this.address,
    required this.subtotalPaise,
    required this.shippingPaise,
    required this.totalPaise,
    required this.status,
    required this.paymentStatus,
    required this.channel,
    required this.preview,
    this.paymentMethod = 'cod',
  });
  factory OrderRecord.fromJson(Object? value) {
    final data = stringMap(value);
    return OrderRecord(
      id: data['id']?.toString() ?? '',
      uid: data['uid']?.toString() ?? '',
      createdAt: dateValue(data['createdAt']),
      lines: (data['lines'] is List ? data['lines'] as List : [])
          .map(OrderLine.fromJson)
          .toList(),
      address: DeliveryAddress.fromJson(data['address']),
      subtotalPaise: intValue(data['subtotalPaise']),
      shippingPaise: intValue(data['shippingPaise']),
      totalPaise: intValue(data['totalPaise']),
      status: data['status']?.toString() ?? 'received',
      paymentStatus: data['paymentStatus']?.toString() ?? 'pending_collection',
      channel: data['channel']?.toString() ?? 'android',
      preview: data['preview'] == true,
      paymentMethod: data['paymentMethod']?.toString() ?? 'cod',
    );
  }
  final String id;
  final String uid;
  final DateTime createdAt;
  final List<OrderLine> lines;
  final DeliveryAddress address;
  final int subtotalPaise;
  final int shippingPaise;
  final int totalPaise;
  final String status;
  final String paymentStatus;
  final String channel;
  final bool preview;
  final String paymentMethod;
  bool get localDemo =>
      preview && paymentMethod == 'demo' && status == 'demo_completed';
  Map<String, Object> toJson() => {
    'id': id,
    'uid': uid,
    'customerPhone': '+91${address.phone}',
    'createdAt': createdAt.toUtc().toIso8601String(),
    'lines': lines.map((line) => line.toJson()).toList(),
    'address': address.toJson(),
    'subtotalPaise': subtotalPaise,
    'shippingPaise': shippingPaise,
    'totalPaise': totalPaise,
    'status': status,
    'paymentMethod': paymentMethod,
    'paymentStatus': paymentStatus,
    'channel': channel,
    'preview': preview,
  };
}

class AccountSnapshot {
  const AccountSnapshot({
    this.profile = const CustomerProfile(),
    this.cart = const [],
    this.address,
    this.guide = const GuideProgress(),
    this.orders = const [],
  });
  final CustomerProfile profile;
  final List<CartLine> cart;
  final DeliveryAddress? address;
  final GuideProgress guide;
  final List<OrderRecord> orders;
}

class PendingCheckout {
  const PendingCheckout({
    required this.uid,
    required this.quote,
    required this.key,
    required this.cart,
    required this.address,
    this.attempted = false,
    this.orderId,
    this.rejectionCode,
    this.remainingCart,
    this.remainingBase,
  });
  factory PendingCheckout.fromJson(Object? value) {
    final data = stringMap(value);
    return PendingCheckout(
      uid: data['uid']?.toString() ?? '',
      quote: CheckoutQuote.fromJson(data['quote']),
      key: data['key']?.toString() ?? '',
      cart: parseCart(data['cart']),
      address: DeliveryAddress.fromJson(data['address']),
      attempted: data['attempted'] == true,
      orderId: data['orderId']?.toString(),
      rejectionCode: data['rejectionCode']?.toString(),
      remainingCart: data['remainingCart'] is List
          ? parseCart(data['remainingCart'])
          : null,
      remainingBase: data['remainingBase'] is List
          ? parseCart(data['remainingBase'])
          : null,
    );
  }
  final String uid;
  final CheckoutQuote quote;
  final String key;
  final List<CartLine> cart;
  final DeliveryAddress address;
  final bool attempted;
  final String? orderId;
  final String? rejectionCode;
  final List<CartLine>? remainingCart;
  final List<CartLine>? remainingBase;
  bool get definitivelyRejected => rejectionCode != null;
  PendingCheckout copyWith({
    bool? attempted,
    String? orderId,
    String? rejectionCode,
    List<CartLine>? remainingCart,
    List<CartLine>? remainingBase,
  }) => PendingCheckout(
    uid: uid,
    quote: quote,
    key: key,
    cart: cart,
    address: address,
    attempted: attempted ?? this.attempted,
    orderId: orderId ?? this.orderId,
    rejectionCode: rejectionCode ?? this.rejectionCode,
    remainingCart: remainingCart ?? this.remainingCart,
    remainingBase: remainingBase ?? this.remainingBase,
  );
  Map<String, Object?> toJson() => {
    'uid': uid,
    'quote': quote.toJson(),
    'key': key,
    'cart': cart.map((line) => line.toJson()).toList(),
    'address': address.toJson(),
    'attempted': attempted,
    'orderId': orderId,
    'rejectionCode': rejectionCode,
    'remainingCart': remainingCart?.map((line) => line.toJson()).toList(),
    'remainingBase': remainingBase?.map((line) => line.toJson()).toList(),
  };
}
