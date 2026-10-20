import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import 'domain/failure.dart';

enum BackendMode { demo, firebase, emulator }

class AppConfig {
  const AppConfig(
    this.mode, {
    this.emulatorHost = '10.0.2.2',
    this.appCheck = 'off',
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
    return AppConfig(
      parsed,
      emulatorHost: const String.fromEnvironment(
        'EMULATOR_HOST',
        defaultValue: '10.0.2.2',
      ),
      appCheck: const String.fromEnvironment(
        'APP_CHECK_PROVIDER',
        defaultValue: 'off',
      ),
    );
  }
  final BackendMode mode;
  final String emulatorHost;
  final String appCheck;
  bool get preview => mode != BackendMode.firebase;
  static const region = 'asia-south1';
  static const projectId = 'narayananaturals-6b5aa';
  static const emulatorProjectId = 'demo-narayana-naturals';
  static const internalBuild = bool.fromEnvironment(
    'INTERNAL_BUILD',
    defaultValue: true,
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
    final app = mode == BackendMode.emulator
        ? await Firebase.initializeApp(demoProjectId: emulatorProjectId)
        : await Firebase.initializeApp(options: androidOptions);
    if (mode == BackendMode.emulator) {
      await FirebaseAuth.instanceFor(
        app: app,
      ).useAuthEmulator(emulatorHost, 9099, automaticHostMapping: false);
      FirebaseFirestore.instanceFor(
        app: app,
      ).useFirestoreEmulator(emulatorHost, 8080, automaticHostMapping: false);
      FirebaseFunctions.instanceFor(
        app: app,
        region: region,
      ).useFunctionsEmulator(emulatorHost, 5001, automaticHostMapping: false);
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
    return app;
  }
}
