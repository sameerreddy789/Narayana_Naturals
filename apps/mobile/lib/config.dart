import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import 'domain/failure.dart';

enum BackendMode { demo, firebase, emulator }

class AppConfig {
  const AppConfig(
    this.mode, {
    this.emulatorHost = '10.0.2.2',
    this.appCheck = 'playIntegrity',
    this.commerceApiUrl = '',
    this.storeStage = 'production',
  });
  factory AppConfig.fromEnvironment() {
    const mode = String.fromEnvironment(
      'BACKEND_MODE',
      defaultValue: 'firebase',
    );
    final parsed = switch (mode) {
      'demo' => BackendMode.demo,
      'firebase' => BackendMode.firebase,
      'emulator' => BackendMode.emulator,
      _ => throw const AppFailure('invalid-backend-mode'),
    };
    final config = AppConfig(
      parsed,
      emulatorHost: const String.fromEnvironment(
        'EMULATOR_HOST',
        defaultValue: '10.0.2.2',
      ),
      appCheck: const String.fromEnvironment(
        'APP_CHECK_PROVIDER',
        defaultValue: 'playIntegrity',
      ),
      commerceApiUrl: const String.fromEnvironment('COMMERCE_API_URL'),
      storeStage: const String.fromEnvironment(
        'STORE_STAGE',
        defaultValue: 'production',
      ),
    );
    config.validate();
    return config;
  }
  final BackendMode mode;
  final String emulatorHost;
  final String appCheck;
  final String commerceApiUrl;
  final String storeStage;
  bool get privateDraft => switch (storeStage) {
    'private-draft' => true,
    'production' => false,
    _ => throw const AppFailure('invalid-store-stage'),
  };
  String get commerceRoot => privateDraft ? 'commerceDraft' : 'commerce';

  void validate({bool internal = internalBuild}) {
    final draft = privateDraft;
    if (!const {'off', 'debug', 'playIntegrity'}.contains(appCheck) ||
        (appCheck == 'debug' && (!draft || !internal)) ||
        (mode == BackendMode.firebase && appCheck == 'off')) {
      throw const AppFailure('APP_CHECK_CONFIG_INVALID');
    }
  }

  Uri get apiUri {
    final configured = commerceApiUrl.isNotEmpty
        ? commerceApiUrl
        : mode == BackendMode.emulator
        ? 'http://$emulatorHost:5002'
        : '';
    final uri = Uri.tryParse(configured);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (mode == BackendMode.firebase && uri.scheme != 'https') ||
        (mode == BackendMode.emulator &&
            (uri.scheme != 'http' || uri.host != emulatorHost))) {
      throw const AppFailure('API_NOT_CONFIGURED');
    }
    return uri;
  }

  bool get preview => mode != BackendMode.firebase || privateDraft;
  static const projectId = 'narayananaturals-6b5aa';
  static const emulatorProjectId = 'demo-narayana-naturals';
  static const internalBuild = bool.fromEnvironment(
    'INTERNAL_BUILD',
    defaultValue: false,
  );

  // Public Android client configuration from the refreshed owner-supplied
  // google-services.json. This is intentionally distinct from the web app key.
  static const androidOptions = FirebaseOptions(
    apiKey: 'AIzaSyAh72R-JNLHOtBESOBePr17iNgmOpQ-SxE',
    appId: '1:255355716241:android:516c520663c796acdd3530',
    messagingSenderId: '255355716241',
    projectId: projectId,
    storageBucket: 'narayananaturals-6b5aa.firebasestorage.app',
    databaseURL: 'https://narayananaturals-6b5aa-default-rtdb.firebaseio.com',
  );

  Future<FirebaseApp> initializeFirebase() async {
    validate();
    final app = mode == BackendMode.emulator
        ? await Firebase.initializeApp(demoProjectId: emulatorProjectId)
        : await Firebase.initializeApp(options: androidOptions);
    if (mode == BackendMode.emulator) {
      await FirebaseAuth.instanceFor(
        app: app,
      ).useAuthEmulator(emulatorHost, 9099, automaticHostMapping: false);
      FirebaseDatabase.instanceFor(
        app: app,
        databaseURL: emulatorDatabaseUrl,
      ).useDatabaseEmulator(emulatorHost, 9000, automaticHostMapping: false);
    } else if (appCheck != 'off') {
      if (appCheck != 'playIntegrity' && appCheck != 'debug') {
        throw const AppFailure('invalid-backend-mode');
      }
      await FirebaseAppCheck.instanceFor(app: app).activate(
        providerAndroid: appCheck == 'debug'
            ? const AndroidDebugProvider()
            : const AndroidPlayIntegrityProvider(),
      );
    }
    final auth = FirebaseAuth.instanceFor(app: app);
    if (auth.currentUser != null && auth.currentUser!.email == null) {
      await auth.signOut();
    }
    return app;
  }

  static const emulatorDatabaseUrl =
      'https://demo-narayana-naturals-default-rtdb.firebaseio.com';
  String get databaseUrl => mode == BackendMode.emulator
      ? emulatorDatabaseUrl
      : androidOptions.databaseURL!;
}
