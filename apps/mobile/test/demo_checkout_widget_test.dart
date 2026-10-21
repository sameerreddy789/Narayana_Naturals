import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:narayana_naturals/ui/app.dart';
import 'demo_checkout_test.dart' show demoAddress;
import 'support/fakes.dart';

Future<void> tapVisible(WidgetTester tester, Finder target) async {
  await tester.ensureVisible(target);
  await tester.pumpAndSettle();
  await tester.tap(target);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'private customer enters address reviews bill and confirms without a COD choice',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final f = await MobileFixture.privateDraft();
      addTearDown(f.controller.dispose);
      await f.controller.welcome(skip: true);
      await f.controller.add('1l');
      await tester.pumpWidget(NarayanaApp(controller: f.controller));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.byKey(const ValueKey('tab_2')));
      await tapVisible(tester, find.byKey(const ValueKey('cart_checkout')));
      for (final entry in {
        'address_name': demoAddress.name,
        'address_phone': demoAddress.phone,
        'address_street': demoAddress.street,
        'address_city': demoAddress.city,
        'address_pin': demoAddress.pin,
      }.entries) {
        await tester.ensureVisible(find.byKey(ValueKey(entry.key)));
        await tester.enterText(find.byKey(ValueKey(entry.key)), entry.value);
      }
      await tapVisible(tester, find.byKey(const ValueKey('address_review')));
      expect(find.text('Demo payment'), findsOneWidget);
      expect(find.text('Cash on delivery'), findsNothing);
      expect(find.text('Demo bill total'), findsOneWidget);
      await tapVisible(
        tester,
        find.byKey(const ValueKey('confirm_demo_payment')),
      );
      expect(find.text('Demo payment confirmed'), findsOneWidget);
      expect(find.textContaining('No money was collected'), findsOneWidget);
      expect(f.controller.orders.single.paymentStatus, 'simulated');
      expect(f.controller.cart, isEmpty);
      expect(f.backend.attempted, isEmpty);
      await tapVisible(tester, find.text('All my orders'));
      expect(find.text('Your demo receipts'), findsOneWidget);
      await tapVisible(tester, find.text('1 L × 1'));
      expect(find.text('Payment simulated · ₹0 collected'), findsOneWidget);
      expect(find.text('Cash on delivery'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
