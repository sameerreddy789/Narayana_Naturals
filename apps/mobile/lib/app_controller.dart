import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import 'config.dart';
import 'data/backend.dart';
import 'data/local_store.dart';
import 'domain/failure.dart';
import 'domain/demo_checkout.dart';
import 'domain/models.dart';

class AppController extends ChangeNotifier {
  AppController(this.backend, this.store)
    : language = store.language,
      cart = store.guestCart;
  final CommerceBackend backend;
  final LocalStore store;
  String language;
  CustomerIdentity? user;
  CustomerProfile profile = const CustomerProfile();
  DeliveryAddress? address;
  GuideProgress guide = const GuideProgress();
  List<OrderRecord> orders = [];
  List<CartLine> cart;
  List<CartLine> _serverCart = [];
  List<CartLine>? _dirtyBase;
  bool cartRefreshed = false;
  Catalogue? catalogue;
  AppFailure? catalogueError, accountError, cartError;
  bool catalogueLoading = true, accountLoading = false, accountReady = false;
  bool cartDirty = false, checkoutBusy = false;
  PendingCheckout? pending;
  StreamSubscription<Catalogue>? _catalogueSubscription;
  StreamSubscription<CustomerIdentity?>? _authSubscription;
  StreamSubscription<AccountSnapshot>? _accountSubscription;
  int _generation = 0, _cartRevision = 0, _guideRevision = 0;
  int _guidePendingWrites = 0, _profilePendingWrites = 0, _profileRevision = 0;
  bool _authInitialized = false, _disposed = false;
  Future<void> _cartWrites = Future<void>.value();
  Future<void> _guideWrites = Future<void>.value();

  bool get privateDraft => backend.privateDraft;
  bool get preview => backend.mode != BackendMode.firebase || privateDraft;
  bool get acceptsPreviewTerms =>
      backend.mode == BackendMode.demo || privateDraft;
  bool get orderingAvailable =>
      !privateDraft &&
      catalogue?.published == true &&
      catalogue!.settings.orderingEnabled &&
      (acceptsPreviewTerms || !catalogue!.settings.preview);
  bool get checkoutAvailable =>
      orderingAvailable || (privateDraft && catalogue?.published == true);
  bool cartAvailable(Variant? variant) =>
      variant != null &&
      (privateDraft
          ? variant.enabled && variant.pricePaise > 0
          : variant.available);
  int cartLimit(Variant? variant) =>
      cartAvailable(variant) ? (privateDraft ? 20 : variant!.quantityLimit) : 0;
  bool get signedIn => user != null;
  bool get canEditCart =>
      (!signedIn || accountReady) && !checkoutBusy && pending?.orderId == null;
  int get packCount => cart.fold(0, (total, line) => total + line.quantity);
  int get estimatedSubtotal => cart.fold(
    0,
    (total, line) =>
        total + (catalogue?.variant(line.id)?.pricePaise ?? 0) * line.quantity,
  );
  String tr(String en, String te) => language == 'te' ? te : en;
  int quantity(String id) {
    for (final line in cart) {
      if (line.id == id) return line.quantity;
    }
    return 0;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  bool _owns(String uid, int generation) =>
      !_disposed && user?.uid == uid && _generation == generation;

  Future<void> start() async {
    _watchCatalogue();
    _authSubscription = backend.authChanges().listen(
      (identity) {
        unawaited(_onAuth(identity));
      },
      onError: (Object error) {
        accountError = AppFailure.from(error);
        _notify();
      },
    );
    await _onAuth(backend.currentUser);
  }

  void _watchCatalogue() {
    _catalogueSubscription = backend.catalogueChanges().listen(
      (value) {
        catalogue = value;
        catalogueLoading = false;
        catalogueError = null;
        _notify();
      },
      onError: (Object error) {
        catalogueLoading = false;
        catalogueError = AppFailure.from(error);
        _notify();
      },
    );
  }

  Future<void> reloadCatalogue() async {
    await _catalogueSubscription?.cancel();
    catalogueLoading = true;
    catalogueError = null;
    _notify();
    _watchCatalogue();
  }

  Future<void> _onAuth(CustomerIdentity? identity, {bool force = false}) async {
    if (_disposed) return;
    if (!force && _authInitialized && user?.uid == identity?.uid) return;
    _authInitialized = true;
    final generation = ++_generation;
    final previousSubscription = _accountSubscription;
    _accountSubscription = null;
    user = identity;
    accountReady = false;
    accountLoading = identity != null;
    accountError = null;
    cartError = null;
    cartDirty = false;
    _dirtyBase = null;
    _serverCart = [];
    cartRefreshed = false;
    checkoutBusy = false;
    _guidePendingWrites = 0;
    _profilePendingWrites = 0;
    profile = CustomerProfile(language: language);
    address = null;
    guide = const GuideProgress();
    orders = [];
    pending = identity == null ? null : store.pendingFor(identity.uid);
    cart = identity == null ? store.guestCart : [];
    _cartRevision++;
    _notify();
    await previousSubscription?.cancel();
    if (generation != _generation || _disposed) return;
    if (identity == null) {
      accountLoading = false;
      _notify();
      return;
    }
    try {
      final value = await backend
          .hydrate(identity, store.guestCart, language)
          .timeout(const Duration(seconds: 20));
      if (!_owns(identity.uid, generation)) return;
      // Clear only guest storage. A previous customer's cart is never exposed
      // as a guest cart or merged into a different email account.
      await store.saveGuestCart([]);
      if (!_owns(identity.uid, generation)) return;
      _applyAccount(value);
      final unsynced = store.read('unsynced-cart_${identity.uid}');
      if (unsynced is Map) {
        final saved = stringMap(unsynced);
        cart = parseCart(saved['lines']);
        _dirtyBase = parseCart(saved['base']);
        cartDirty = true;
      } else if (unsynced is List) {
        cart = parseCart(unsynced);
        _dirtyBase = List.of(value.cart);
        cartDirty = true;
      } else if (pending?.remainingCart != null) {
        cart = List.of(pending!.remainingCart!);
        _dirtyBase = List.of(pending!.remainingBase ?? pending!.cart);
        cartDirty = true;
      }
      accountLoading = false;
      accountReady = true;
      _notify();
      _accountSubscription = backend
          .accountChanges(identity)
          .listen(
            (value) {
              if (!_owns(identity.uid, generation)) return;
              _applyAccount(value);
              _notify();
            },
            onError: (Object error) {
              if (_owns(identity.uid, generation)) {
                accountError = AppFailure.from(error);
                _notify();
              }
            },
          );
      if (pending?.orderId != null) {
        await finishCompletedCheckout();
      } else if (cartDirty) {
        try {
          await syncCart();
        } catch (_) {
          /* Cart error remains actionable. */
        }
      }
    } catch (error) {
      if (_owns(identity.uid, generation)) {
        accountError = AppFailure.from(error);
        accountLoading = false;
        accountReady = false;
        _notify();
      }
    }
  }

  void _applyAccount(AccountSnapshot value) {
    _serverCart = List.of(value.cart);
    if (!cartDirty) cart = List.of(value.cart);
    // New accounts do not have a profile until the customer supplies a name.
    // Their device language must not be reset by a missing profile document.
    if (_profilePendingWrites == 0 && value.profile.displayName.length >= 2) {
      profile = value.profile;
      language = value.profile.language;
      unawaited(store.saveLanguage(language).catchError((_) {}));
    }
    address = value.address;
    if (_guidePendingWrites == 0) guide = value.guide;
    orders = [
      if (privateDraft && user != null) ...store.demoReceiptsFor(user!.uid),
      ...value.orders.where((order) => acceptsPreviewTerms || !order.preview),
    ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    accountError = null;
  }

  Future<void> retryAccount() => _onAuth(backend.currentUser, force: true);

  Future<void> setQuantity(String id, int value) async {
    if (!canEditCart) throw const AppFailure('ACCOUNT_LOADING');
    if (!variantIds.contains(id) || value < 0 || value > 20) {
      throw const AppFailure('INVALID_INPUT');
    }
    final old = quantity(id);
    final variant = catalogue?.variant(id);
    if (value > old &&
        (!cartAvailable(variant) || value > cartLimit(variant))) {
      throw const AppFailure('OUT_OF_STOCK');
    }
    final updated = cart.where((line) => line.id != id).toList();
    if (value > 0) updated.add(CartLine(id, value));
    updated.sort(
      (a, b) => variantIds.indexOf(a.id).compareTo(variantIds.indexOf(b.id)),
    );
    await _setCart(updated);
  }

  Future<void> add(String id) => setQuantity(id, quantity(id) + 1);
  Future<void> _setCart(List<CartLine> value) async {
    final before = List<CartLine>.of(cart);
    _dirtyBase ??= before;
    cart = List.of(value);
    final revision = ++_cartRevision;
    cartError = null;
    cartRefreshed = false;
    final identity = user;
    if (identity == null) {
      _notify();
      try {
        await store.saveGuestCart(cart);
      } catch (error) {
        cartError = AppFailure.from(error);
        _notify();
        rethrow;
      }
      return;
    }
    final generation = _generation;
    cartDirty = true;
    _notify();
    try {
      // Persist the desired cart before a network write; this key is scoped to
      // the current UID and backend mode and survives an offline restart.
      await store.write('unsynced-cart_${identity.uid}', {
        'lines': value.map((line) => line.toJson()).toList(),
        'base': _dirtyBase!.map((line) => line.toJson()).toList(),
      });
      await _queueCartSave(
        identity.uid,
        generation,
        revision,
        List.of(value),
        before,
      );
    } catch (error) {
      if (_owns(identity.uid, generation)) {
        cartError = AppFailure.from(error);
        _notify();
      }
      rethrow;
    }
  }

  Future<void> _queueCartSave(
    String uid,
    int generation,
    int revision,
    List<CartLine> value,
    List<CartLine> before,
  ) {
    final operation = _cartWrites.catchError((_) {}).then((_) async {
      if (!_owns(uid, generation)) return;
      final merged = await backend
          .saveCart(
            uid,
            value,
            before,
            acknowledged: List.of(_dirtyBase ?? before),
          )
          .timeout(const Duration(seconds: 15));
      if (_owns(uid, generation)) _serverCart = List.of(merged);
      if (_owns(uid, generation) && revision == _cartRevision) {
        await store.write('unsynced-cart_$uid', null);
        cartRefreshed = !listEquals(merged, value);
        cart = List.of(merged);
        _dirtyBase = null;
        cartDirty = false;
        cartError = null;
        _notify();
      }
    });
    _cartWrites = operation.catchError((_) {});
    return operation;
  }

  Future<void> syncCart() async {
    final identity = user;
    if (identity == null) return store.saveGuestCart(cart);
    if (!accountReady) throw const AppFailure('ACCOUNT_LOADING');
    final generation = _generation;
    final before = List<CartLine>.of(_dirtyBase ?? _serverCart);
    _dirtyBase ??= before;
    cartDirty = true;
    cartError = null;
    _notify();
    try {
      await store.write('unsynced-cart_${identity.uid}', {
        'lines': cart.map((line) => line.toJson()).toList(),
        'base': before.map((line) => line.toJson()).toList(),
      });
      await _queueCartSave(
        identity.uid,
        generation,
        _cartRevision,
        List.of(cart),
        before,
      );
    } catch (error) {
      if (_owns(identity.uid, generation)) {
        cartError = AppFailure.from(error);
        _notify();
      }
      rethrow;
    }
  }

  Future<void> saveAddress(DeliveryAddress value) async {
    final identity = user;
    if (identity == null) throw const AppFailure('AUTH_REQUIRED');
    if (!accountReady) throw const AppFailure('ACCOUNT_LOADING');
    if (!value.valid) throw const AppFailure('INVALID_INPUT');
    final generation = _generation;
    final updated = CustomerProfile(
      displayName: value.name,
      language: language,
    );
    final revision = ++_profileRevision;
    _profilePendingWrites++;
    try {
      await backend
          .saveAddress(identity.uid, value)
          .timeout(const Duration(seconds: 15));
      if (!_owns(identity.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      await backend
          .saveProfile(identity, updated)
          .timeout(const Duration(seconds: 15));
      if (!_owns(identity.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      address = value;
      if (revision == _profileRevision) profile = updated;
      _notify();
    } finally {
      if (_owns(identity.uid, generation)) _profilePendingWrites--;
    }
  }

  Future<void> saveName(String value) async {
    final identity = user;
    if (identity == null) throw const AppFailure('AUTH_REQUIRED');
    if (!accountReady) throw const AppFailure('ACCOUNT_LOADING');
    if (value.trim().length < 2 || value.length > 100) {
      throw const AppFailure('INVALID_INPUT');
    }
    final generation = _generation;
    final updated = CustomerProfile(
      displayName: value.trim(),
      language: language,
    );
    final revision = ++_profileRevision;
    _profilePendingWrites++;
    try {
      await backend
          .saveProfile(identity, updated)
          .timeout(const Duration(seconds: 15));
      if (!_owns(identity.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      if (revision == _profileRevision) profile = updated;
      _notify();
    } finally {
      if (_owns(identity.uid, generation)) _profilePendingWrites--;
    }
  }

  Future<void> setLanguage(String value) async {
    final old = language;
    final identity = user;
    final generation = _generation;
    final revision = ++_profileRevision;
    final sync =
        identity != null && accountReady && profile.displayName.length >= 2;
    if (sync) _profilePendingWrites++;
    language = value == 'te' ? 'te' : 'en';
    _notify();
    final updated = CustomerProfile(
      displayName: profile.displayName,
      language: language,
    );
    try {
      await store.saveLanguage(updated.language);
      if (!sync) return;
      if (!_owns(identity.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      await backend
          .saveProfile(identity, updated)
          .timeout(const Duration(seconds: 15));
      if (_owns(identity.uid, generation) && revision == _profileRevision) {
        profile = updated;
        _notify();
      }
    } catch (error) {
      if (identity != null &&
          _owns(identity.uid, generation) &&
          revision == _profileRevision) {
        language = old;
        await store.saveLanguage(old);
        _notify();
      }
      rethrow;
    } finally {
      if (sync && _owns(identity.uid, generation)) _profilePendingWrites--;
    }
  }

  Future<void> saveGuide(GuideProgress value) async {
    final identity = user;
    if (identity == null || !accountReady) {
      throw const AppFailure('AUTH_REQUIRED');
    }
    final generation = _generation, revision = ++_guideRevision;
    _guidePendingWrites++;
    final previous = guide;
    guide = value;
    _notify();
    final operation = _guideWrites.catchError((_) {}).then((_) async {
      if (!_owns(identity.uid, generation)) return;
      await backend
          .saveGuide(identity.uid, value)
          .timeout(const Duration(seconds: 15));
    });
    _guideWrites = operation.catchError((_) {});
    try {
      await operation;
    } catch (error) {
      if (_owns(identity.uid, generation) && revision == _guideRevision) {
        guide = previous;
        _notify();
      }
      rethrow;
    } finally {
      if (_owns(identity.uid, generation)) _guidePendingWrites--;
    }
  }

  Future<void> welcome({required bool skip}) =>
      saveGuide(guide.welcome(skip: skip));
  Future<void> dismissGuide(String page) => saveGuide(guide.dismiss(page));
  Future<void> skipGuides() => saveGuide(
    GuideProgress(
      welcomeSeen: true,
      skipped: true,
      dismissedPages: guide.dismissedPages,
    ),
  );
  Future<void> replayGuides() => saveGuide(const GuideProgress());

  Future<PendingCheckout> reviewCheckout(DeliveryAddress delivery) async {
    final identity = user;
    final generation = _generation;
    if (identity == null) throw const AppFailure('AUTH_REQUIRED');
    if (!identity.emailAccount) throw const AppFailure('EMAIL_REQUIRED');
    if (!accountReady) throw const AppFailure('ACCOUNT_LOADING');
    if (checkoutBusy || pending?.attempted == true) {
      throw const AppFailure('PENDING_CHECKOUT');
    }
    if (!delivery.valid) throw const AppFailure('INVALID_INPUT');
    if (cart.isEmpty) throw const AppFailure('EMPTY_CART');
    if (cartDirty) {
      await syncCart();
      if (!_owns(identity.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      if (cartDirty) throw const AppFailure('CART_SYNC');
    }
    if (!checkoutAvailable) {
      throw const AppFailure('STORE_NOT_READY');
    }
    final requested = List<CartLine>.of(cart);
    checkoutBusy = true;
    _notify();
    try {
      final random = Random.secure();
      final key =
          'nn_${base64Url.encode(List.generate(24, (_) => random.nextInt(256))).replaceAll('=', '')}';
      final quote = privateDraft
          ? demoQuote(
              catalogue: catalogue!,
              cart: requested,
              address: delivery,
              key: key,
            )
          : await backend.quote(requested, delivery);
      if (!_owns(identity.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      if ((quote.preview && !acceptsPreviewTerms) ||
          quote.quoteId.length < 8 ||
          quote.lines.length != requested.length ||
          !requested.every(
            (item) => quote.lines.any(
              (line) => line.id == item.id && line.quantity == item.quantity,
            ),
          ) ||
          quote.totalPaise != quote.subtotalPaise + quote.shippingPaise ||
          (!quote.codAllowed && !(privateDraft && quote.localDemo))) {
        throw AppFailure(
          !quote.codAllowed ? 'COD_UNAVAILABLE' : 'STORE_NOT_READY',
        );
      }
      final value = PendingCheckout(
        uid: identity.uid,
        quote: quote,
        key: key,
        cart: requested,
        address: delivery,
      );
      await store.savePending(identity.uid, value);
      if (!_owns(identity.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      pending = value;
      _notify();
      return value;
    } finally {
      if (_owns(identity.uid, generation)) {
        checkoutBusy = false;
        _notify();
      }
    }
  }

  Future<String> submitPending() async {
    final value = pending;
    if (value == null) throw const AppFailure('QUOTE_NOT_FOUND');
    if (user?.uid != value.uid) throw const AppFailure('AUTH_REQUIRED');
    if (!accountReady) throw const AppFailure('ACCOUNT_LOADING');
    if (checkoutBusy) throw const AppFailure('PENDING_CHECKOUT');
    if (value.orderId != null) {
      await finishCompletedCheckout();
      return value.orderId!;
    }
    if (privateDraft) return _confirmDemoPayment(value);
    final generation = _generation;
    checkoutBusy = true;
    _notify();
    var attempted = value.copyWith(attempted: true);
    try {
      // The original quote and key are made durable before the first callable.
      // A retry always uses this snapshot, even with an empty or changed cart.
      await store.savePending(value.uid, attempted);
      if (!_owns(value.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      pending = attempted;
      _notify();
      final id = await backend.placeCod(attempted);
      attempted = attempted.copyWith(orderId: id);
      await store.savePending(value.uid, attempted);
      if (_owns(value.uid, generation)) {
        pending = attempted;
        _notify();
        await finishCompletedCheckout();
      }
      return id;
    } catch (error) {
      final failure = AppFailure.from(error);
      if (failure.definitiveCheckoutRejection && attempted.orderId == null) {
        attempted = attempted.copyWith(rejectionCode: failure.code);
        await store.savePending(value.uid, attempted);
        if (_owns(value.uid, generation)) {
          pending = attempted;
          _notify();
        }
      }
      rethrow;
    } finally {
      if (_owns(value.uid, generation)) {
        checkoutBusy = false;
        _notify();
      }
    }
  }

  Future<String> _confirmDemoPayment(PendingCheckout value) async {
    if (!value.quote.localDemo || catalogue == null) {
      throw const AppFailure('STORE_NOT_READY');
    }
    final generation = _generation;
    checkoutBusy = true;
    _notify();
    try {
      final receiptId = 'NN-DEMO-${value.key}';
      final saved = store
          .demoReceiptsFor(value.uid)
          .where((receipt) => receipt.id == receiptId)
          .firstOrNull;
      if (saved == null) {
        await syncCart();
        if (!_owns(value.uid, generation)) {
          throw const AppFailure('AUTH_REQUIRED');
        }
        validateDemoBill(value, catalogue!, cart);
      }
      // A deterministic receipt is made durable before clearing the shared
      // cart. Retrying a storage/cart failure cannot confirm this bill twice.
      final receipt =
          saved ?? await store.saveDemoReceipt(value.uid, demoReceipt(value));
      if (!_owns(value.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      final completed = value.copyWith(attempted: true, orderId: receipt.id);
      await store.savePending(value.uid, completed);
      if (!_owns(value.uid, generation)) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      pending = completed;
      orders = [receipt, ...orders.where((order) => order.id != receipt.id)];
      _notify();
      await finishCompletedCheckout();
      return receipt.id;
    } finally {
      if (_owns(value.uid, generation)) {
        checkoutBusy = false;
        _notify();
      }
    }
  }

  Future<void> finishCompletedCheckout() async {
    var value = pending;
    if (value?.orderId == null || !accountReady || value!.uid != user?.uid) {
      return;
    }
    final generation = _generation;
    final uid = value.uid;
    try {
      if (value.remainingCart == null) {
        final before = List<CartLine>.of(cart);
        final remaining = clearPurchasedLines(cart, value.cart);
        value = value.copyWith(remainingCart: remaining, remainingBase: before);
        // The cleanup snapshot is durable together with the known order ID.
        // If the network fails, reopening cannot clear newly added items twice.
        await store.savePending(value.uid, value);
        if (!_owns(value.uid, generation)) return;
        pending = value;
        cart = List.of(remaining);
        _dirtyBase = before;
        _cartRevision++;
        cartDirty = true;
        _notify();
      }
      await syncCart();
      if (!_owns(value.uid, generation) || cartDirty) return;
      await store.savePending(value.uid, null);
      if (_owns(value.uid, generation) && pending?.key == value.key) {
        pending = null;
        _notify();
      }
    } catch (error) {
      if (_owns(uid, generation)) {
        cartError = AppFailure.from(error);
        _notify();
      }
      // The order is already accepted. A cart-sync failure must never be
      // reported as an order failure or cause another purchase.
    }
  }

  Future<void> discardRejectedOrUnattemptedCheckout() async {
    final value = pending;
    if (checkoutBusy || value == null || value.orderId != null) return;
    if (value.attempted && !value.definitivelyRejected) {
      throw const AppFailure('PENDING_CHECKOUT');
    }
    await store.savePending(value.uid, null);
    if (user?.uid == value.uid && pending?.key == value.key) {
      pending = null;
      _notify();
    }
  }

  Future<int> reorder(OrderRecord order) async {
    if (!canEditCart) throw const AppFailure('ACCOUNT_LOADING');
    var unavailable = 0;
    final quantities = {for (final line in cart) line.id: line.quantity};
    for (final line in order.lines) {
      final variant = catalogue?.variant(line.id);
      if (!cartAvailable(variant)) {
        unavailable++;
        continue;
      }
      final desired = (quantities[line.id] ?? 0) + line.quantity;
      final allowed = cartLimit(variant);
      if (desired > allowed) unavailable++;
      quantities[line.id] = min(desired, allowed);
    }
    final value = variantIds
        .where((id) => (quantities[id] ?? 0) > 0)
        .map((id) => CartLine(id, quantities[id]!))
        .toList();
    if (value.isEmpty) throw const AppFailure('OUT_OF_STOCK');
    await _setCart(value);
    return unavailable;
  }

  Future<OrderRecord> loadOrder(String id) async {
    final identity = user;
    if (identity == null) throw const AppFailure('AUTH_REQUIRED');
    for (final order in orders) {
      if (order.id == id) {
        if (order.preview && !acceptsPreviewTerms) {
          throw const AppFailure('STORE_NOT_READY');
        }
        return order;
      }
    }
    if (id.startsWith('NN-DEMO-')) throw const AppFailure('ORDER_NOT_FOUND');
    final order = await backend
        .loadOrder(identity.uid, id)
        .timeout(const Duration(seconds: 20));
    if (order.preview && !acceptsPreviewTerms) {
      throw const AppFailure('STORE_NOT_READY');
    }
    return order;
  }

  Future<void> signOut() => backend.signOut();
  @override
  void dispose() {
    _disposed = true;
    _generation++;
    unawaited(_catalogueSubscription?.cancel());
    unawaited(_authSubscription?.cancel());
    unawaited(_accountSubscription?.cancel());
    super.dispose();
  }
}
