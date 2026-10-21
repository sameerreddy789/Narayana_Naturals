import 'dart:async';

import 'package:shared_preferences/shared_preferences.dart';

import 'package:narayana_naturals/app_controller.dart';
import 'package:narayana_naturals/config.dart';
import 'package:narayana_naturals/data/demo_backend.dart';
import 'package:narayana_naturals/data/local_store.dart';
import 'package:narayana_naturals/domain/failure.dart';
import 'package:narayana_naturals/domain/models.dart';

const customerEmail = 'customer@narayana.test';
const previewPassword = 'NarayanaDemo123!';
const otherEmail = 'other@narayana.test';
const delivery = DeliveryAddress(
  name: 'Preview Customer',
  phone: '6000000001',
  street: '10 Sample Street',
  city: 'Chittoor',
  pin: '517001',
);

Future<void> flushEvents() async {
  for (var i = 0; i < 30; i++) {
    await Future<void>.value();
  }
}

Future<void> until(bool Function() ready) async {
  for (var i = 0; i < 200; i++) {
    if (ready()) return;
    await Future<void>.value();
  }
  throw StateError('The expected customer state did not settle.');
}

class TestingBackend extends DemoCommerceBackend {
  TestingBackend(super.store);
  final attempted = <PendingCheckout>[];
  final savedCarts = <List<CartLine>>[];
  Completer<void>? hydrationGate;
  AppFailure? failBeforePurchase;
  bool interruptAfterPurchase = false;
  bool failNextCartSave = false;
  @override
  Future<AccountSnapshot> hydrate(
    CustomerIdentity identity,
    List<CartLine> guest,
    String language,
  ) async {
    await hydrationGate?.future;
    return super.hydrate(identity, guest, language);
  }

  @override
  Future<String> placeCod(PendingCheckout checkout) async {
    attempted.add(checkout);
    final failure = failBeforePurchase;
    failBeforePurchase = null;
    if (failure != null) throw failure;
    final result = await super.placeCod(checkout);
    if (interruptAfterPurchase) {
      interruptAfterPurchase = false;
      throw const AppFailure('unavailable');
    }
    return result;
  }

  @override
  Future<List<CartLine>> saveCart(
    String uid,
    List<CartLine> lines,
    List<CartLine> before, {
    List<CartLine>? acknowledged,
  }) async {
    savedCarts.add(List.of(lines));
    if (failNextCartSave) {
      failNextCartSave = false;
      throw const AppFailure('unavailable');
    }
    return super.saveCart(uid, lines, before, acknowledged: acknowledged);
  }
}

class MobileFixture {
  const MobileFixture(this.controller, this.backend, this.store);
  final AppController controller;
  final TestingBackend backend;
  final LocalStore store;
  static Future<MobileFixture> privateDraft({LocalStore? savedStore}) async {
    if (savedStore == null) SharedPreferences.setMockInitialValues({});
    final store =
        savedStore ??
        LocalStore(
          await SharedPreferences.getInstance(),
          BackendMode.firebase,
          storeStage: 'private-draft',
        );
    final backend = PrivateDraftTestingBackend(store);
    if (backend.currentUser == null) {
      await backend.signInEmail(customerEmail, previewPassword);
    }
    final controller = AppController(backend, store);
    await controller.start();
    await until(() => controller.accountReady && controller.catalogue != null);
    await flushEvents();
    return MobileFixture(controller, backend, store);
  }

  static Future<MobileFixture> create({bool signedIn = true}) async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final store = LocalStore(preferences, BackendMode.demo);
    return resume(store, signedIn: signedIn);
  }

  static Future<MobileFixture> resume(
    LocalStore store, {
    bool signedIn = true,
  }) async {
    final backend = TestingBackend(store);
    if (signedIn && backend.currentUser == null) {
      await backend.signInEmail(customerEmail, previewPassword);
    }
    final controller = AppController(backend, store);
    await controller.start();
    await until(
      () =>
          controller.catalogue != null &&
          (!signedIn || controller.accountReady),
    );
    await flushEvents();
    return MobileFixture(controller, backend, store);
  }
}

class FailingLiveBackend extends TestingBackend {
  FailingLiveBackend(super.store);
  @override
  BackendMode get mode => BackendMode.firebase;
  @override
  Stream<Catalogue> catalogueChanges() =>
      Stream<Catalogue>.error(const AppFailure('unavailable'));
}

class PrivateDraftTestingBackend extends TestingBackend {
  PrivateDraftTestingBackend(super.store);
  int quoteCalls = 0;
  @override
  Future<CheckoutQuote> quote(
    List<CartLine> lines,
    DeliveryAddress address,
  ) async {
    quoteCalls++;
    throw StateError('The private simulated bill must not call the order API');
  }

  @override
  BackendMode get mode => BackendMode.firebase;
  @override
  bool get privateDraft => true;
  @override
  Stream<Catalogue> catalogueChanges() => super.catalogueChanges().map(
    (value) => Catalogue(
      product: value.product,
      variants: value.variants
          .map(
            (variant) => Variant(
              id: variant.id,
              litres: variant.litres,
              pricePaise: variant.pricePaise,
              stock: 0,
              enabled: true,
              stockConfirmed: false,
            ),
          )
          .toList(),
      // An accidentally enabled remote setting must still not open ordering
      // in the private demonstration build.
      settings: const StoreSettings(orderingEnabled: true, preview: true),
    ),
  );
}
