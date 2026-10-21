import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../config.dart';
import 'widgets.dart';

class PrivateDeviceSetup extends StatelessWidget {
  const PrivateDeviceSetup({super.key});

  static const enabled =
      AppConfig.internalBuild &&
      String.fromEnvironment('BACKEND_MODE', defaultValue: 'firebase') ==
          'firebase' &&
      String.fromEnvironment('STORE_STAGE', defaultValue: 'production') ==
          'private-draft' &&
      String.fromEnvironment(
            'APP_CHECK_PROVIDER',
            defaultValue: 'playIntegrity',
          ) ==
          'debug';
  static const _channel = MethodChannel('narayananaturals/private_setup');

  Future<void> _copy(BuildContext context) async {
    bool copied;
    try {
      copied = await _channel.invokeMethod<bool>('copyDeviceCode') ?? false;
    } on PlatformException {
      copied = false;
    } on MissingPluginException {
      copied = false;
    }
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          copied
              ? context.tr(
                  'Device code copied. Register it for the Android app in Firebase Console.',
                  'పరికర కోడ్ కాపీ అయింది. Firebase Consoleలో Android యాప్‌కు నమోదు చేయండి.',
                )
              : context.tr(
                  'Reopen the app, wait for Shop to load, then try copying the code again.',
                  'యాప్‌ను మళ్లీ తెరిచి, షాప్ లోడ్ అయ్యాక కోడ్‌ను మళ్లీ కాపీ చేయండి.',
                ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!enabled) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              context.tr(
                'Set up this test phone',
                'ఈ పరీక్ష ఫోన్‌ను సిద్ధం చేయండి',
              ),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              context.tr(
                'Copy this phone’s registration code. The project owner must add it in Firebase Console → App Check → Android app → Manage debug tokens. Each phone needs its own entry. Keep the code private.',
                'ఈ ఫోన్ నమోదు కోడ్‌ను కాపీ చేయండి. ప్రాజెక్ట్ యజమాని దాన్ని Firebase Console → App Check → Android app → Manage debug tokensలో జోడించాలి. ప్రతి ఫోన్‌కు ప్రత్యేక నమోదు అవసరం. కోడ్‌ను గోప్యంగా ఉంచండి.',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => _copy(context),
              icon: const Icon(Icons.copy_outlined),
              label: Text(
                context.tr('Copy device code', 'పరికర కోడ్ కాపీ చేయండి'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
