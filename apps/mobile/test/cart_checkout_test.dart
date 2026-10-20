import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:narayana_naturals/config.dart';
import 'package:narayana_naturals/domain/failure.dart';
import 'package:narayana_naturals/domain/models.dart';

import 'support/fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('normal APK configuration is Firebase, never a preview fallback', () {
    expect(AppConfig.fromEnvironment().mode, BackendMode.firebase);
    expect(AppConfig.androidOptions.projectId, 'narayananaturals-6b5aa');
    expect(
      AppConfig.androidOptions.appId,
      '1:255355716241:android:516c520663c796acdd3530',
    );
  });
  test(
    'guest merge is idempotent and combines pack sizes without doubling',
    () {
      const remote = [CartLine('1l', 3), CartLine('5l', 1)];
      const guest = [CartLine('1l', 2), CartLine('2l', 2)];
      final once = mergeCarts(remote, guest);
      expect(once, const [
        CartLine('1l', 3),
        CartLine('2l', 2),
        CartLine('5l', 1),
      ]);
      expect(mergeCarts(once, guest), once);
      expect(
        parseCart([
          {'id': 'other', 'quantity': 5},
          {'id': '2l', 'quantity': 80},
        ]),
        const [CartLine('2l', 20)],
      );
    },
  );
  test('Unicode addresses and integer paise follow the shared contract', () {
    const address = DeliveryAddress(
      name: 'సమీర్',
      phone: '6000000001',
      street: 'ఇంటి నంబర్ 10, ప్రధాన వీధి',
      city: 'చిత్తూరు',
      pin: '517001',
    );
    expect(address.valid, isTrue);
    expect(DeliveryAddress.fromJson(address.toJson()).valid, isTrue);
    expect(money(225000), '₹2,250');
    expect(money(1050), '₹10.50');
  });
  test(
    'REST API machine code drives localized recovery, never payment success',
    () {
      final failure = AppFailure.fromApi({
        'error': {'code': 'QUOTE_CHANGED', 'message': 'Server rejected order'},
      });
      expect(failure.code, 'QUOTE_CHANGED');
      expect(failure.definitiveCheckoutRejection, isTrue);
      expect(failure.message('te'), contains('కొత్త'));
      expect(
        AppFailure.from(
          TimeoutException('No response'),
        ).definitiveCheckoutRejection,
        isFalse,
      );
      expect(const AppFailure('internal').definitiveCheckoutRejection, isFalse);
    },
  );
  test(
    'signed-in cart stays empty and uneditable until server hydration',
    () async {
      final f = await MobileFixture.create(signedIn: false);
      addTearDown(f.controller.dispose);
      await f.controller.setQuantity('1l', 2);
      f.backend.hydrationGate = Completer<void>();
      await f.backend.signInEmail(customerEmail, previewPassword);
      await until(() => f.controller.accountLoading);
      expect(f.controller.cart, isEmpty);
      await expectLater(
        f.controller.add('2l'),
        throwsA(
          isA<AppFailure>().having(
            (value) => value.code,
            'code',
            'ACCOUNT_LOADING',
          ),
        ),
      );
      expect(f.backend.savedCarts, isEmpty);
      f.backend.hydrationGate!.complete();
      await until(() => f.controller.accountReady);
      expect(f.controller.cart, const [CartLine('1l', 2)]);
      expect(f.store.guestCart, isEmpty);
    },
  );
  test(
    'account switching never exposes another account cart address or guide',
    () async {
      final f = await MobileFixture.create();
      addTearDown(f.controller.dispose);
      await f.controller.setQuantity('2l', 3);
      await f.controller.saveAddress(delivery);
      await f.controller.welcome(skip: false);
      await f.controller.dismissGuide('shop');
      await flushEvents();
      final pending = await f.controller.reviewCheckout(delivery);
      await f.backend.signOut();
      await until(() => f.controller.user == null);
      expect(f.controller.cart, isEmpty);
      expect(f.controller.address, isNull);
      expect(f.controller.pending, isNull);
      await f.backend.signInEmail(otherEmail, previewPassword);
      await until(
        () =>
            f.controller.accountReady && f.controller.user?.email == otherEmail,
      );
      expect(f.controller.cart, isEmpty);
      expect(f.controller.address, isNull);
      expect(f.controller.orders, isEmpty);
      expect(f.controller.guide.welcomeSeen, isFalse);
      expect(f.controller.pending, isNull);
      await f.backend.signInEmail(customerEmail, previewPassword);
      await until(
        () =>
            f.controller.accountReady &&
            f.controller.user?.email == customerEmail,
      );
      expect(f.controller.cart, const [CartLine('2l', 3)]);
      expect(f.controller.address?.name, delivery.name);
      expect(f.controller.guide.dismissedPages, contains('shop'));
      expect(f.controller.pending?.key, pending.key);
    },
  );
  test(
    'ambiguous response retries original purchase with an empty cart and zero displayed stock',
    () async {
      final f = await MobileFixture.create();
      addTearDown(f.controller.dispose);
      await f.controller.add('1l');
      final original = await f.controller.reviewCheckout(delivery);
      f.backend.interruptAfterPurchase = true;
      await expectLater(
        f.controller.submitPending(),
        throwsA(isA<AppFailure>()),
      );
      await flushEvents();
      expect(f.controller.orders.length, 1);
      expect(f.controller.pending?.attempted, isTrue);
      await expectLater(
        f.controller.discardRejectedOrUnattemptedCheckout(),
        throwsA(isA<AppFailure>()),
      );
      await f.controller.setQuantity('1l', 0);
      final catalogue = f.controller.catalogue!;
      f.controller.catalogue = Catalogue(
        product: catalogue.product,
        settings: catalogue.settings,
        variants: catalogue.variants
            .map((variant) => variant.withStock(0))
            .toList(),
      );
      final id = await f.controller.submitPending();
      await flushEvents();
      expect(id, f.controller.orders.single.id);
      expect(f.controller.orders.length, 1);
      expect(f.controller.cart, isEmpty);
      expect(f.backend.attempted.map((value) => value.key).toSet(), {
        original.key,
      });
      expect(f.backend.attempted.map((value) => value.quote.quoteId).toSet(), {
        original.quote.quoteId,
      });
      expect(
        f.backend.attempted.last.address.toJson(),
        original.address.toJson(),
      );
    },
  );
  test('successful retry removes only unchanged purchased lines', () async {
    final f = await MobileFixture.create();
    addTearDown(f.controller.dispose);
    await f.controller.add('1l');
    await f.controller.add('2l');
    final original = await f.controller.reviewCheckout(delivery);
    f.backend.interruptAfterPurchase = true;
    await expectLater(f.controller.submitPending(), throwsA(isA<AppFailure>()));
    await f.controller.setQuantity('1l', 2);
    await f.controller.submitPending();
    await flushEvents();
    expect(f.controller.orders.length, 1);
    expect(f.controller.orders.single.totalPaise, original.quote.totalPaise);
    expect(f.controller.orders.single.lines.map((line) => line.quantity), [
      1,
      1,
    ]);
    expect(f.controller.cart, const [CartLine('1l', 2)]);
  });
  test('pending key and order snapshot survive an app restart', () async {
    final f = await MobileFixture.create();
    await f.controller.add('5l');
    final original = await f.controller.reviewCheckout(delivery);
    f.backend.interruptAfterPurchase = true;
    await expectLater(f.controller.submitPending(), throwsA(isA<AppFailure>()));
    f.controller.dispose();
    await flushEvents();
    final restarted = await MobileFixture.resume(f.store);
    addTearDown(restarted.controller.dispose);
    expect(restarted.controller.pending?.key, original.key);
    final id = await restarted.controller.submitPending();
    await flushEvents();
    expect(restarted.controller.orders.single.id, id);
    expect(restarted.controller.pending, isNull);
    expect(restarted.controller.catalogue?.variant('5l')?.stock, 63);
  });
  test(
    'cart sync failure after order success keeps confirmation and durable cleanup',
    () async {
      final f = await MobileFixture.create();
      await f.controller.add('1l');
      await f.controller.reviewCheckout(delivery);
      f.backend.failNextCartSave = true;
      final id = await f.controller.submitPending();
      expect(f.controller.pending?.orderId, id);
      expect(f.controller.pending?.remainingCart, isEmpty);
      expect(f.controller.cartError?.code, 'unavailable');
      f.controller.dispose();
      await flushEvents();
      final restarted = await MobileFixture.resume(f.store);
      addTearDown(restarted.controller.dispose);
      await until(() => restarted.controller.pending == null);
      expect(restarted.controller.orders.single.id, id);
      expect(restarted.controller.cart, isEmpty);
      expect(restarted.backend.attempted, isEmpty);
    },
  );
  test('a definitive changed quote requires a visible fresh review', () async {
    final f = await MobileFixture.create();
    addTearDown(f.controller.dispose);
    await f.controller.add('1l');
    final original = await f.controller.reviewCheckout(delivery);
    f.backend.failBeforePurchase = const AppFailure('QUOTE_CHANGED');
    await expectLater(f.controller.submitPending(), throwsA(isA<AppFailure>()));
    expect(f.controller.pending?.definitivelyRejected, isTrue);
    expect(f.controller.orders, isEmpty);
    await f.controller.discardRejectedOrUnattemptedCheckout();
    final fresh = await f.controller.reviewCheckout(delivery);
    expect(fresh.key, isNot(original.key));
    expect(fresh.attempted, isFalse);
    expect(f.controller.orders, isEmpty);
  });
  test('an offline edited cart restores only for its owning UID', () async {
    final f = await MobileFixture.create();
    f.backend.failNextCartSave = true;
    await expectLater(
      f.controller.setQuantity('2l', 2),
      throwsA(isA<AppFailure>()),
    );
    expect(f.controller.cart, const [CartLine('2l', 2)]);
    expect(f.controller.cartDirty, isTrue);
    f.controller.dispose();
    await flushEvents();
    final restarted = await MobileFixture.resume(f.store);
    addTearDown(restarted.controller.dispose);
    await until(() => !restarted.controller.cartDirty);
    expect(restarted.controller.cart, const [CartLine('2l', 2)]);
    await restarted.backend.signInEmail(otherEmail, previewPassword);
    await until(
      () =>
          restarted.controller.accountReady &&
          restarted.controller.user?.email == otherEmail,
    );
    expect(restarted.controller.cart, isEmpty);
  });
  test('editing another pack retries the earlier unsaved pack', () async {
    final f = await MobileFixture.create();
    addTearDown(f.controller.dispose);
    f.backend.failNextCartSave = true;
    await expectLater(
      f.controller.setQuantity('1l', 2),
      throwsA(isA<AppFailure>()),
    );
    await f.controller.add('2l');
    await flushEvents();
    final saved = await f.backend.hydrate(f.controller.user!, [], 'en');
    expect(saved.cart, const [CartLine('1l', 2), CartLine('2l', 1)]);
    expect(f.controller.cart, saved.cart);
    expect(f.controller.cartDirty, isFalse);
  });
  test('decreasing an unsaved increase saves the final quantity', () async {
    final f = await MobileFixture.create();
    addTearDown(f.controller.dispose);
    await f.controller.setQuantity('1l', 1);
    f.backend.failNextCartSave = true;
    await expectLater(
      f.controller.setQuantity('1l', 3),
      throwsA(isA<AppFailure>()),
    );
    await f.controller.setQuantity('1l', 2);
    await flushEvents();
    final saved = await f.backend.hydrate(f.controller.user!, [], 'en');
    expect(saved.cart, const [CartLine('1l', 2)]);
    expect(f.controller.cartDirty, isFalse);
  });
  test('conflicting newer quantities and unrelated packs survive a retry', () {
    const remote = [CartLine('1l', 7), CartLine('5l', 1)];
    const before = [CartLine('1l', 3)];
    const desired = [CartLine('1l', 2), CartLine('2l', 1)];
    const acknowledged = [CartLine('1l', 1)];
    final saved = applyCartEdit(
      remote,
      before,
      desired,
      acknowledged: acknowledged,
    );
    expect(saved, const [
      CartLine('1l', 7),
      CartLine('2l', 1),
      CartLine('5l', 1),
    ]);
    expect(
      applyCartEdit(saved, before, desired, acknowledged: acknowledged),
      saved,
    );
  });
  test('welcome skip dismiss and replay persist per account', () async {
    final f = await MobileFixture.create();
    addTearDown(f.controller.dispose);
    expect(f.controller.guide.welcomeSeen, isFalse);
    await f.controller.welcome(skip: false);
    await f.controller.dismissGuide('cart');
    await flushEvents();
    expect(f.controller.guide.shouldShow('cart'), isFalse);
    expect(f.controller.guide.shouldShow('orders'), isTrue);
    await f.controller.skipGuides();
    await flushEvents();
    expect(f.controller.guide.shouldShow('orders'), isFalse);
    await f.controller.replayGuides();
    await flushEvents();
    expect(f.controller.guide.welcomeSeen, isFalse);
    expect(f.controller.guide.dismissedPages, isEmpty);
  });
  test(
    'saving name makes selected Telugu language durable in the account',
    () async {
      final f = await MobileFixture.create();
      addTearDown(f.controller.dispose);
      await f.controller.setLanguage('te');
      await f.controller.saveName('సమీర్');
      await flushEvents();
      expect(f.controller.language, 'te');
      expect(f.controller.profile.language, 'te');
      await f.controller.setLanguage('en');
      await flushEvents();
      expect(f.controller.profile.language, 'en');
      expect(f.controller.language, 'en');
    },
  );
  test('unserviceable PIN cannot become a preview order', () async {
    final f = await MobileFixture.create();
    addTearDown(f.controller.dispose);
    await f.controller.add('1l');
    const address = DeliveryAddress(
      name: 'Preview Customer',
      phone: '6000000001',
      street: '10 Sample Street',
      city: 'Chittoor',
      pin: '999999',
    );
    await expectLater(
      f.controller.reviewCheckout(address),
      throwsA(
        isA<AppFailure>().having(
          (error) => error.code,
          'code',
          'NOT_SERVICEABLE',
        ),
      ),
    );
    expect(f.controller.pending, isNull);
    expect(f.controller.orders, isEmpty);
    expect(f.controller.cart, const [CartLine('1l', 1)]);
  });
}
