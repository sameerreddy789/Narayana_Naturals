import '../config.dart';
import '../domain/failure.dart';
import '../domain/models.dart';

abstract class CommerceBackend {
  BackendMode get mode;
  CustomerIdentity? get currentUser;
  Stream<CustomerIdentity?> authChanges();
  Stream<Catalogue> catalogueChanges();
  Future<AccountSnapshot> hydrate(
    CustomerIdentity identity,
    List<CartLine> guest,
    String language,
  );
  Stream<AccountSnapshot> accountChanges(CustomerIdentity identity);
  Future<List<CartLine>> saveCart(
    String uid,
    List<CartLine> lines,
    List<CartLine> before, {
    List<CartLine>? acknowledged,
  });
  Future<void> saveAddress(String uid, DeliveryAddress address);
  Future<void> saveProfile(CustomerIdentity identity, CustomerProfile profile);
  Future<void> saveGuide(String uid, GuideProgress guide);
  Future<CheckoutQuote> quote(List<CartLine> lines, DeliveryAddress address);
  Future<String> placeCod(PendingCheckout checkout);
  Future<OrderRecord> loadOrder(String uid, String orderId);
  Future<void> requestPhoneCode(
    String phone, {
    int? resendToken,
    required void Function(String verificationId, int? resendToken) codeSent,
    required void Function(AppFailure error) failed,
    required void Function() authenticated,
    required void Function() timedOut,
    required bool Function() acceptCredential,
  });
  Future<void> confirmPhoneCode(String verificationId, String code);
  Future<void> signInPreview(String phone);
  Future<void> signOut();
}
