import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

class AppFailure implements Exception {
  const AppFailure(this.code);
  factory AppFailure.from(Object error) {
    if (error is AppFailure) return error;
    if (error is FirebaseAuthException) return AppFailure(error.code);
    if (error is FirebaseException) {
      return AppFailure(
        error.code == 'PERMISSION_DENIED' ? 'permission-denied' : error.code,
      );
    }
    if (error is http.ClientException) return const AppFailure('unavailable');
    if (error is TimeoutException) return const AppFailure('unavailable');
    return const AppFailure('unknown');
  }
  factory AppFailure.fromApi(Object? value) {
    final error = value is Map ? value['error'] : null;
    final code = error is Map ? error['code'] : null;
    return AppFailure(code is String ? code : 'unavailable');
  }
  final String code;

  /// These responses prove that the server rejected the order. Network and
  /// unknown failures never permit discarding an attempted retry key.
  bool get definitiveCheckoutRejection => const {
    'INVALID_INPUT',
    'STORE_NOT_READY',
    'NOT_SERVICEABLE',
    'OUT_OF_STOCK',
    'QUOTE_EXPIRED',
    'QUOTE_CHANGED',
    'QUOTE_NOT_FOUND',
    'QUOTE_OWNER_MISMATCH',
    'COD_UNAVAILABLE',
    'IDEMPOTENCY_CONFLICT',
    'STORE_CAPACITY',
  }.contains(code);
  String message(String language) {
    final pair = _messages[code] ?? _messages['unknown']!;
    return pair[language == 'te' ? 1 : 0];
  }

  @override
  String toString() => 'AppFailure($code)';
}

const _messages = <String, List<String>>{
  'AUTH_REQUIRED': [
    'Sign in with your email to continue.',
    'కొనసాగడానికి మీ ఈమెయిల్‌తో సైన్ ఇన్ చేయండి.',
  ],
  'unauthenticated': [
    'Your sign-in expired. Sign in again with the same email.',
    'మీ సైన్ ఇన్ గడువు ముగిసింది. అదే ఈమెయిల్‌తో మళ్లీ సైన్ ఇన్ చేయండి.',
  ],
  'EMAIL_REQUIRED': [
    'Sign in with your email account before checkout.',
    'ఆర్డర్‌కు ముందు మీ ఈమెయిల్ ఖాతాతో సైన్ ఇన్ చేయండి.',
  ],
  'INVALID_INPUT': [
    'Check the address and pack quantities, then try again.',
    'చిరునామా, ప్యాక్ పరిమాణాలను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.',
  ],
  'STORE_NOT_READY': [
    'Ordering is not available yet. Please check back later.',
    'ఆర్డర్ సౌకర్యం ఇంకా సిద్ధంగా లేదు. తర్వాత మళ్లీ చూడండి.',
  ],
  'NOT_SERVICEABLE': [
    'Delivery is not available for this PIN. Check your PIN or contact the store.',
    'ఈ పిన్ కోడ్‌కు డెలివరీ లేదు. పిన్‌ను తనిఖీ చేయండి లేదా స్టోర్‌ను సంప్రదించండి.',
  ],
  'OUT_OF_STOCK': [
    'A selected pack is unavailable. Update your cart and review a new total.',
    'ఎంచుకున్న ప్యాక్ అందుబాటులో లేదు. కార్ట్‌ను మార్చి కొత్త మొత్తాన్ని సమీక్షించండి.',
  ],
  'QUOTE_EXPIRED': [
    'This total has expired. Review a new total before ordering.',
    'ఈ మొత్తం గడువు ముగిసింది. ఆర్డర్‌కు ముందు కొత్త మొత్తాన్ని సమీక్షించండి.',
  ],
  'QUOTE_CHANGED': [
    'Price or delivery terms changed. Review the new total before ordering.',
    'ధర లేదా డెలివరీ షరతులు మారాయి. కొత్త మొత్తాన్ని సమీక్షించండి.',
  ],
  'QUOTE_NOT_FOUND': [
    'This checkout is no longer available. Review a new total.',
    'ఈ చెక్అవుట్ ఇప్పుడు అందుబాటులో లేదు. కొత్త మొత్తాన్ని సమీక్షించండి.',
  ],
  'QUOTE_OWNER_MISMATCH': [
    'This checkout belongs to another account. Use the original email account.',
    'ఈ చెక్అవుట్ మరో ఖాతాకు చెందినది. మొదటి ఈమెయిల్ ఖాతాను ఉపయోగించండి.',
  ],
  'COD_UNAVAILABLE': [
    'Cash on delivery is not available for this PIN.',
    'ఈ పిన్‌కు నగదు చెల్లింపు అందుబాటులో లేదు.',
  ],
  'IDEMPOTENCY_CONFLICT': [
    'The checkout retry could not be linked. Check your orders before trying again.',
    'ఆర్డర్‌ను మళ్లీ ప్రయత్నించే ముందు మీ ఆర్డర్‌లను తనిఖీ చేయండి.',
  ],
  'RATE_LIMITED': [
    'Too many checkout requests. Wait a moment, then retry the same order.',
    'ఎక్కువ ఆర్డర్ అభ్యర్థనలు వచ్చాయి. కొద్దిసేపు ఆగి అదే ఆర్డర్‌ను మళ్లీ ప్రయత్నించండి.',
  ],
  'ORDER_NOT_FOUND': [
    'This order could not be found. Refresh your orders.',
    'ఈ ఆర్డర్ కనిపించలేదు. మీ ఆర్డర్‌లను రిఫ్రెష్ చేయండి.',
  ],
  'permission-denied': [
    'Your account cannot access this data. Retry sign-in or contact the store.',
    'మీ ఖాతాకు ఈ సమాచారం అందుబాటులో లేదు. మళ్లీ సైన్ ఇన్ చేయండి లేదా స్టోర్‌ను సంప్రదించండి.',
  ],
  'unavailable': [
    'Connection interrupted. Check your internet connection and retry.',
    'కనెక్షన్ ఆగిపోయింది. ఇంటర్నెట్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.',
  ],
  'network-request-failed': [
    'Check your internet connection, then try again.',
    'ఇంటర్నెట్ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.',
  ],
  'deadline-exceeded': [
    'The response took too long. Retry the same order to check its result.',
    'స్పందన ఆలస్యమైంది. ఫలితం కోసం అదే ఆర్డర్‌ను మళ్లీ ప్రయత్నించండి.',
  ],
  'invalid-phone-number': [
    'Enter a valid 10-digit Indian mobile number.',
    'చెల్లుబాటు అయ్యే 10 అంకెల భారతీయ మొబైల్ నంబర్‌ను నమోదు చేయండి.',
  ],
  'too-many-requests': [
    'Too many sign-in attempts. Wait a moment, then try again.',
    'ఎక్కువ సైన్ ఇన్ ప్రయత్నాలు జరిగాయి. కొద్దిసేపు ఆగి మళ్లీ ప్రయత్నించండి.',
  ],
  'quota-exceeded': [
    'The sign-in limit was reached. Please try later or contact the store.',
    'సైన్ ఇన్ పరిమితి చేరుకుంది. తర్వాత ప్రయత్నించండి లేదా స్టోర్‌ను సంప్రదించండి.',
  ],
  'operation-not-allowed': [
    'Email sign-in is not available yet. Contact the store or try later.',
    'ఈమెయిల్ సైన్ ఇన్ ఇంకా అందుబాటులో లేదు. తర్వాత ప్రయత్నించండి లేదా స్టోర్‌ను సంప్రదించండి.',
  ],
  'app-not-authorized': [
    'This app build is not authorized for sign-in. Contact the store.',
    'ఈ యాప్ వెర్షన్‌కు సైన్ ఇన్ అనుమతి లేదు. స్టోర్‌ను సంప్రదించండి.',
  ],
  'invalid-app-credential': [
    'App verification could not start. Check your connection or contact the store.',
    'యాప్ ధృవీకరణ ప్రారంభం కాలేదు. కనెక్షన్‌ను తనిఖీ చేయండి లేదా స్టోర్‌ను సంప్రదించండి.',
  ],
  'invalid-backend-mode': [
    'This app build has an invalid connection setting.',
    'ఈ యాప్ కనెక్షన్ సెట్టింగ్ సరైనది కాదు.',
  ],
  'API_NOT_CONFIGURED': [
    'Checkout connection is being set up. Your cart is saved; please try again later.',
    'చెక్అవుట్ కనెక్షన్ సిద్ధమవుతోంది. మీ కార్ట్ సేవ్ అయింది; తర్వాత మళ్లీ ప్రయత్నించండి.',
  ],
  'APP_CHECK_REQUIRED': [
    'App verification could not complete. Refresh or contact the store.',
    'యాప్ ధృవీకరణ పూర్తి కాలేదు. రిఫ్రెష్ చేయండి లేదా స్టోర్‌ను సంప్రదించండి.',
  ],
  'STORE_CAPACITY': [
    'The store is temporarily unable to accept new orders. Your existing orders are saved.',
    'స్టోర్ తాత్కాలికంగా కొత్త ఆర్డర్‌లను స్వీకరించలేకపోతోంది. మీ పాత ఆర్డర్‌లు భద్రంగా ఉన్నాయి.',
  ],
  'UNAVAILABLE': [
    'The order service could not complete this request. Retry the same order.',
    'ఆర్డర్ సేవ ఈ అభ్యర్థన పూర్తి చేయలేకపోయింది. అదే ఆర్డర్‌ను మళ్లీ ప్రయత్నించండి.',
  ],
  'invalid-email': [
    'Enter a valid email address.',
    'చెల్లుబాటు అయ్యే ఈమెయిల్ చిరునామా నమోదు చేయండి.',
  ],
  'invalid-credential': [
    'Email or password is incorrect. Check them or reset your password.',
    'ఈమెయిల్ లేదా పాస్‌వర్డ్ సరైనది కాదు. సరిచూడండి లేదా పాస్‌వర్డ్ మార్చుకోండి.',
  ],
  'wrong-password': [
    'Email or password is incorrect. Check them or reset your password.',
    'ఈమెయిల్ లేదా పాస్‌వర్డ్ సరైనది కాదు. సరిచూడండి లేదా పాస్‌వర్డ్ మార్చుకోండి.',
  ],
  'user-not-found': [
    'Email or password is incorrect. Check them or create an account.',
    'ఈమెయిల్ లేదా పాస్‌వర్డ్ సరైనది కాదు. సరిచూడండి లేదా ఖాతా సృష్టించండి.',
  ],
  'email-already-in-use': [
    'An account already uses this email. Sign in or reset your password.',
    'ఈ ఈమెయిల్‌తో ఖాతా ఉంది. సైన్ ఇన్ చేయండి లేదా పాస్‌వర్డ్ మార్చుకోండి.',
  ],
  'weak-password': [
    'Choose a password with at least 8 characters.',
    'కనీసం 8 అక్షరాల పాస్‌వర్డ్ ఎంచుకోండి.',
  ],
  'user-disabled': [
    'This account is disabled. Contact the store.',
    'ఈ ఖాతా నిలిపివేయబడింది. స్టోర్‌ను సంప్రదించండి.',
  ],
  'ACCOUNT_LOADING': [
    'Wait for your account and cart to finish loading.',
    'మీ ఖాతా, కార్ట్ లోడ్ అయ్యే వరకు వేచి ఉండండి.',
  ],
  'CART_SYNC': [
    'Cart changes have not synced. Retry cart sync before checkout.',
    'కార్ట్ మార్పులు సేవ్ కాలేదు. ఆర్డర్‌కు ముందు కార్ట్ సింక్‌ను మళ్లీ ప్రయత్నించండి.',
  ],
  'EMPTY_CART': [
    'Add a pack to your cart before checkout.',
    'ఆర్డర్‌కు ముందు కార్ట్‌లో ప్యాక్‌ను జోడించండి.',
  ],
  'PENDING_CHECKOUT': [
    'Check the result of your previous order before starting another.',
    'కొత్త ఆర్డర్‌కు ముందు మీ గత ఆర్డర్ ఫలితాన్ని తనిఖీ చేయండి.',
  ],
  'LOCAL_STORAGE': [
    'The checkout could not be saved on this device. Free some space and try again.',
    'ఈ పరికరంలో చెక్అవుట్ సేవ్ కాలేదు. స్థలం ఖాళీ చేసి మళ్లీ ప్రయత్నించండి.',
  ],
  'CONTACT_UNAVAILABLE': [
    'The contact app could not open. Try calling the support number directly.',
    'సంప్రదింపు యాప్ తెరవలేదు. సహాయ నంబర్‌కు నేరుగా కాల్ చేయండి.',
  ],
  'unknown': [
    'Something could not load. Try again; your cart is preserved.',
    'సమాచారం లోడ్ కాలేదు. మళ్లీ ప్రయత్నించండి; మీ కార్ట్ భద్రంగా ఉంది.',
  ],
};
