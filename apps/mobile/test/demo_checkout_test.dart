import 'package:flutter_test/flutter_test.dart';
import 'package:narayana_naturals/config.dart';
import 'package:narayana_naturals/data/local_store.dart';
import 'package:narayana_naturals/domain/demo_checkout.dart';
import 'package:narayana_naturals/domain/failure.dart';
import 'package:narayana_naturals/domain/models.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'support/fakes.dart';

const demoAddress = DeliveryAddress(
  name: 'Demo Tester',
  phone: '6000000001',
  street: '12 Example Street',
  city: 'Tirupati',
  pin: '517502',
);
Matcher failure(String code) =>
    throwsA(isA<AppFailure>().having((error) => error.code, 'code', code));

class UnavailableReceiptStore extends LocalStore {
  UnavailableReceiptStore(SharedPreferences preferences)
    : super(preferences, BackendMode.firebase, storeStage: 'private-draft');
  bool failReceipts = true;
  @override
  Future<void> write(String suffix, Object? value) async {
    if (failReceipts && suffix.startsWith('demo-receipts_')) {
      throw const AppFailure('LOCAL_STORAGE');
    }
    return super.write(suffix, value);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'private cart allows sample packs without declaring physical stock available',
    () async {
      final f = await MobileFixture.privateDraft();
      addTearDown(f.controller.dispose);
      final variant = f.controller.catalogue!.variant('1l')!;
      expect(variant.available, isFalse);
      expect(variant.stockConfirmed, isFalse);
      expect(variant.stock, 0);
      await f.controller.setQuantity('1l', 20);
      expect(f.controller.estimatedSubtotal, 900000);
      await expectLater(f.controller.add('1l'), failure('INVALID_INPUT'));
      expect(f.controller.orderingAvailable, isFalse);
      expect(f.controller.checkoutAvailable, isTrue);
    },
  );
  test(
    'demo bill requires the approved PIN and never asks the order API',
    () async {
      final f = await MobileFixture.privateDraft();
      addTearDown(f.controller.dispose);
      await f.controller.add('1l');
      await expectLater(
        f.controller.reviewCheckout(delivery),
        failure('DEMO_PIN'),
      );
      expect((f.backend as PrivateDraftTestingBackend).quoteCalls, 0);
      expect(f.controller.pending, isNull);
      expect(f.controller.orders, isEmpty);
    },
  );
  test(
    'address bill and simulated receipt complete without COD or a backend order',
    () async {
      final f = await MobileFixture.privateDraft();
      addTearDown(f.controller.dispose);
      await f.controller.setQuantity('1l', 2);
      await f.controller.add('2l');
      await f.controller.add('5l');
      await f.controller.saveAddress(demoAddress);
      final pending = await f.controller.reviewCheckout(demoAddress);
      expect(pending.quote.totalPaise, 405000);
      expect(pending.quote.shippingPaise, 0);
      expect(pending.quote.codAllowed, isFalse);
      final id = await f.controller.submitPending();
      final receipt = f.controller.orders.single;
      expect(receipt.id, id);
      expect(receipt.paymentMethod, 'demo');
      expect(receipt.paymentStatus, 'simulated');
      expect(receipt.localDemo, isTrue);
      expect(receipt.address.pin, '517502');
      expect(f.controller.cart, isEmpty);
      expect(f.controller.pending, isNull);
      expect(f.backend.attempted, isEmpty);
      expect((f.backend as PrivateDraftTestingBackend).quoteCalls, 0);
      expect(f.store.read('account_${receipt.uid}') is Map, isTrue);
      expect(
        (f.store.read('account_${receipt.uid}') as Map)['orders'] ?? [],
        isEmpty,
      );
    },
  );
  test('a changed cart cannot confirm the old bill', () async {
    final f = await MobileFixture.privateDraft();
    addTearDown(f.controller.dispose);
    await f.controller.add('1l');
    await f.controller.reviewCheckout(demoAddress);
    await f.controller.add('2l');
    await expectLater(f.controller.submitPending(), failure('QUOTE_CHANGED'));
    expect(f.controller.orders, isEmpty);
    expect(f.controller.cart.length, 2);
  });
  test('expired bills do not become local receipts', () async {
    final f = await MobileFixture.privateDraft();
    addTearDown(f.controller.dispose);
    final quote = demoQuote(
      catalogue: f.controller.catalogue!,
      cart: const [CartLine('1l', 1)],
      address: demoAddress,
      key: 'expiry_test_key',
      now: DateTime.utc(2020),
    );
    final pending = PendingCheckout(
      uid: f.controller.user!.uid,
      quote: quote,
      key: 'expiry_test_key',
      cart: const [CartLine('1l', 1)],
      address: demoAddress,
    );
    expect(
      () => validateDemoBill(pending, f.controller.catalogue!, pending.cart),
      failure('QUOTE_EXPIRED'),
    );
  });
  test(
    'receipts survive restart and remain isolated when accounts switch',
    () async {
      final f = await MobileFixture.privateDraft();
      await f.controller.add('1l');
      await f.controller.reviewCheckout(demoAddress);
      final id = await f.controller.submitPending();
      final owner = f.controller.user!.uid;
      await f.controller.signOut();
      await until(() => !f.controller.signedIn);
      expect(f.controller.orders, isEmpty);
      await f.backend.signInEmail(otherEmail, previewPassword);
      await until(() => f.controller.accountReady);
      expect(f.controller.orders, isEmpty);
      expect(f.store.demoReceiptsFor(f.controller.user!.uid), isEmpty);
      await expectLater(f.controller.loadOrder(id), failure('ORDER_NOT_FOUND'));
      await f.controller.signOut();
      await until(() => !f.controller.signedIn);
      await f.backend.signInEmail(customerEmail, previewPassword);
      await until(() => f.controller.accountReady);
      expect(f.controller.orders.single.uid, owner);
      f.controller.dispose();
      final restored = await MobileFixture.privateDraft(savedStore: f.store);
      addTearDown(restored.controller.dispose);
      expect(
        (await restored.controller.loadOrder(id)).paymentStatus,
        'simulated',
      );
      expect(restored.controller.cart, isEmpty);
    },
  );
  test(
    'local storage failure keeps the cart and retry creates only one receipt',
    () async {
      SharedPreferences.setMockInitialValues({});
      final store = UnavailableReceiptStore(
        await SharedPreferences.getInstance(),
      );
      final f = await MobileFixture.privateDraft(savedStore: store);
      addTearDown(f.controller.dispose);
      await f.controller.add('1l');
      await f.controller.reviewCheckout(demoAddress);
      await expectLater(f.controller.submitPending(), failure('LOCAL_STORAGE'));
      expect(f.controller.cart, const [CartLine('1l', 1)]);
      expect(f.controller.orders, isEmpty);
      store.failReceipts = false;
      final first = f.controller.submitPending();
      await expectLater(
        f.controller.submitPending(),
        failure('PENDING_CHECKOUT'),
      );
      final id = await first;
      expect(f.store.demoReceiptsFor(f.controller.user!.uid).single.id, id);
      expect(f.controller.orders.length, 1);
      expect(f.backend.attempted, isEmpty);
    },
  );
}
