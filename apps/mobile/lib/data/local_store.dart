import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import '../domain/failure.dart';
import '../domain/models.dart';

class LocalStore {
  const LocalStore(
    this.preferences,
    this.mode, {
    this.storeStage = 'production',
  });
  final SharedPreferences preferences;
  final BackendMode mode;
  final String storeStage;
  String key(String suffix) =>
      'narayana_${mode.name}_${storeStage == 'private-draft' ? 'draft_' : ''}v1_$suffix';
  Object? read(String suffix) {
    final value = preferences.getString(key(suffix));
    if (value == null) return null;
    try {
      return jsonDecode(value);
    } catch (_) {
      return null;
    }
  }

  Future<void> write(String suffix, Object? value) async {
    final saved = value == null
        ? await preferences.remove(key(suffix))
        : await preferences.setString(key(suffix), jsonEncode(value));
    if (!saved) throw const AppFailure('LOCAL_STORAGE');
  }

  List<CartLine> get guestCart => parseCart(read('guest-cart'));
  Future<void> saveGuestCart(List<CartLine> cart) =>
      write('guest-cart', cart.map((line) => line.toJson()).toList());
  String get language => read('language') == 'te' ? 'te' : 'en';
  Future<void> saveLanguage(String value) => write('language', value);
  PendingCheckout? pendingFor(String uid) {
    final value = read('checkout_$uid');
    if (value == null) return null;
    final pending = PendingCheckout.fromJson(value);
    if (pending.uid != uid ||
        pending.key.length < 8 ||
        pending.quote.quoteId.length < 8) {
      return null;
    }
    return pending;
  }

  Future<void> savePending(String uid, PendingCheckout? pending) =>
      write('checkout_$uid', pending?.toJson());

  List<OrderRecord> demoReceiptsFor(String uid) {
    final raw = read('demo-receipts_$uid');
    if (storeStage != 'private-draft' || raw is! List) return [];
    final unique = <String, OrderRecord>{};
    for (final value in raw) {
      final receipt = OrderRecord.fromJson(value);
      if (receipt.uid != uid ||
          !receipt.localDemo ||
          !receipt.id.startsWith('NN-DEMO-') ||
          receipt.paymentStatus != 'simulated' ||
          !receipt.address.valid ||
          receipt.address.pin != '517502' ||
          receipt.lines.isEmpty ||
          receipt.shippingPaise != 0 ||
          receipt.totalPaise != receipt.subtotalPaise ||
          receipt.subtotalPaise !=
              receipt.lines.fold(0, (sum, line) => sum + line.totalPaise) ||
          receipt.lines.any(
            (line) =>
                !variantIds.contains(line.id) ||
                line.quantity < 1 ||
                line.quantity > 20 ||
                line.unitPricePaise <= 0,
          )) {
        continue;
      }
      unique.putIfAbsent(receipt.id, () => receipt);
    }
    return unique.values.take(50).toList();
  }

  Future<OrderRecord> saveDemoReceipt(String uid, OrderRecord receipt) async {
    if (storeStage != 'private-draft' ||
        receipt.uid != uid ||
        !receipt.localDemo) {
      throw const AppFailure('AUTH_REQUIRED');
    }
    final receipts = demoReceiptsFor(uid);
    for (final saved in receipts) {
      if (saved.id == receipt.id) return saved;
    }
    await write(
      'demo-receipts_$uid',
      [receipt, ...receipts].take(50).map((entry) => entry.toJson()).toList(),
    );
    return receipt;
  }
}
