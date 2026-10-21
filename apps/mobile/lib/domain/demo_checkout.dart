import 'failure.dart';
import 'models.dart';

/// A client demonstration bill. It never reserves inventory or calls a
/// payment/order endpoint. Real stock and delivery terms stay unconfirmed.
CheckoutQuote demoQuote({
  required Catalogue catalogue,
  required List<CartLine> cart,
  required DeliveryAddress address,
  required String key,
  DateTime? now,
}) {
  if (!address.valid) throw const AppFailure('INVALID_INPUT');
  if (address.pin != '517502') throw const AppFailure('DEMO_PIN');
  if (!catalogue.published) throw const AppFailure('STORE_NOT_READY');
  if (cart.isEmpty) throw const AppFailure('EMPTY_CART');
  if (cart.map((line) => line.id).toSet().length != cart.length) {
    throw const AppFailure('INVALID_INPUT');
  }
  final lines = cart.map((line) {
    final variant = catalogue.variant(line.id);
    if (variant == null ||
        !variant.enabled ||
        variant.pricePaise <= 0 ||
        !variantIds.contains(line.id) ||
        line.quantity < 1 ||
        line.quantity > 20) {
      throw const AppFailure('OUT_OF_STOCK');
    }
    return OrderLine(
      id: line.id,
      quantity: line.quantity,
      litres: variant.litres,
      unitPricePaise: variant.pricePaise,
    );
  }).toList();
  final subtotal = lines.fold(0, (total, line) => total + line.totalPaise);
  return CheckoutQuote(
    quoteId: 'demo_quote_$key',
    subtotalPaise: subtotal,
    shippingPaise: 0,
    totalPaise: subtotal,
    codAllowed: false,
    estimate: 'Demonstration only · No delivery is booked',
    expiresAt: (now ?? DateTime.now()).add(const Duration(minutes: 10)),
    preview: true,
    lines: lines,
  );
}

void validateDemoBill(
  PendingCheckout checkout,
  Catalogue catalogue,
  List<CartLine> currentCart, {
  DateTime? now,
}) {
  final quote = checkout.quote;
  if (!quote.localDemo || quote.codAllowed) {
    throw const AppFailure('STORE_NOT_READY');
  }
  if (!(now ?? DateTime.now()).isBefore(quote.expiresAt)) {
    throw const AppFailure('QUOTE_EXPIRED');
  }
  final fresh = demoQuote(
    catalogue: catalogue,
    cart: currentCart,
    address: checkout.address,
    key: checkout.key,
    now: now,
  );
  if (fresh.totalPaise != quote.totalPaise ||
      quote.shippingPaise != 0 ||
      quote.subtotalPaise != quote.totalPaise ||
      fresh.lines.length != quote.lines.length ||
      !fresh.lines.every(
        (line) => quote.lines.any(
          (saved) =>
              saved.id == line.id &&
              saved.quantity == line.quantity &&
              saved.litres == line.litres &&
              saved.unitPricePaise == line.unitPricePaise,
        ),
      )) {
    throw const AppFailure('QUOTE_CHANGED');
  }
}

OrderRecord demoReceipt(PendingCheckout checkout, {DateTime? now}) =>
    OrderRecord(
      id: 'NN-DEMO-${checkout.key}',
      uid: checkout.uid,
      createdAt: now ?? DateTime.now(),
      lines: List.of(checkout.quote.lines),
      address: checkout.address,
      subtotalPaise: checkout.quote.subtotalPaise,
      shippingPaise: checkout.quote.shippingPaise,
      totalPaise: checkout.quote.totalPaise,
      status: 'demo_completed',
      paymentMethod: 'demo',
      paymentStatus: 'simulated',
      channel: 'android',
      preview: true,
    );
