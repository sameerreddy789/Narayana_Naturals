import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_controller.dart';
import 'config.dart';
import 'data/demo_backend.dart';
import 'data/firebase_backend.dart';
import 'data/local_store.dart';
import 'domain/failure.dart';
import 'ui/app.dart';
import 'ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AppBootstrap());
}

class AppBootstrap extends StatefulWidget {
  const AppBootstrap({super.key});
  @override
  State<AppBootstrap> createState() => _AppBootstrapState();
}

class _AppBootstrapState extends State<AppBootstrap> {
  late Future<AppController> future = initialize();
  AppController? controller;
  Future<AppController> initialize() async {
    final config = AppConfig.fromEnvironment();
    final preferences = await SharedPreferences.getInstance();
    final store = LocalStore(preferences, config.mode);
    final backend = config.mode == BackendMode.demo
        ? DemoCommerceBackend(store)
        : FirebaseCommerceBackend(await config.initializeFirebase(), config);
    final app = AppController(backend, store);
    controller = app;
    await app.start();
    return app;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<AppController>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.hasData) return NarayanaApp(controller: snapshot.data!);
      return MaterialApp(
        title: 'Narayana Naturals',
        debugShowCheckedModeBanner: false,
        theme: brandTheme(dark: false, language: 'en'),
        home: Scaffold(
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 500),
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.eco_outlined,
                        size: 64,
                        color: Color(0xff183a28),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Narayana Naturals',
                        style: TextStyle(
                          fontFamily: 'Anek',
                          fontWeight: FontWeight.w600,
                          fontSize: 28,
                        ),
                      ),
                      const SizedBox(height: 24),
                      if (snapshot.hasError) ...[
                        Text(
                          AppFailure.from(snapshot.error!).message('en'),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: () {
                            controller?.dispose();
                            setState(() => future = initialize());
                          },
                          child: const Text('Try again'),
                        ),
                      ] else ...[
                        const CircularProgressIndicator(),
                        const SizedBox(height: 20),
                        const Text('Opening your store…'),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }
}
