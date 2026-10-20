import '../config.dart';
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
  Future<void> signInEmail(
    String email,
    String password, {
    String? name,
    bool createAccount = false,
    String language = 'en',
  });
  Future<void> resetPassword(String email);
  Future<void> signOut();
}
