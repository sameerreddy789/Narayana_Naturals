import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:narayana_naturals/app_controller.dart';
import 'package:narayana_naturals/ui/app.dart';

import 'support/fakes.dart';

void phoneViewport(
  WidgetTester tester, {
  double width = 390,
  double height = 844,
}) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = Size(width, height);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('preview customer can shop sign in quote order and reorder', (
    tester,
  ) async {
    phoneViewport(tester);
    final f = await MobileFixture.create(signedIn: false);
    addTearDown(f.controller.dispose);
    await tester.pumpWidget(NarayanaApp(controller: f.controller));
    await tester.pumpAndSettle();
    expect(find.textContaining('Preview · Sample prices'), findsOneWidget);
    await tapVisible(tester, find.byKey(const ValueKey('home_shop')));
    await tapVisible(tester, find.byKey(const ValueKey('add_1l')));
    await tester.tap(find.byKey(const ValueKey('tab_2')));
    await tester.pumpAndSettle();
    await tapVisible(tester, find.byKey(const ValueKey('cart_checkout')));
    expect(find.text('Sign in & continue'), findsOneWidget);
    expect(
      tester
          .widget<TextFormField>(find.byKey(const ValueKey('sign_in_email')))
          .controller!
          .text,
      isEmpty,
    );
    expect(find.text('Fill sample credentials'), findsNothing);
    await tester.enterText(
      find.byKey(const ValueKey('sign_in_email')),
      customerEmail,
    );
    await tester.enterText(
      find.byKey(const ValueKey('sign_in_password')),
      previewPassword,
    );
    await tapVisible(tester, find.byKey(const ValueKey('sign_in_continue')));
    expect(find.text('Welcome to Narayana Naturals'), findsOneWidget);
    await tapVisible(tester, find.byKey(const ValueKey('welcome_skip')));
    expect(find.byKey(const ValueKey('preview_address')), findsNothing);
    for (final entry in {
      'address_name': delivery.name,
      'address_phone': delivery.phone,
      'address_street': delivery.street,
      'address_city': delivery.city,
      'address_pin': delivery.pin,
    }.entries) {
      await tester.ensureVisible(find.byKey(ValueKey(entry.key)));
      await tester.enterText(find.byKey(ValueKey(entry.key)), entry.value);
    }
    await tapVisible(tester, find.byKey(const ValueKey('address_review')));
    expect(
      find.text('Your complete total'),
      findsOneWidget,
      reason: tester
          .widgetList<Text>(find.byType(Text))
          .map((text) => text.data ?? '')
          .join('\n'),
    );
    expect(find.text('₹480'), findsWidgets);
    await tapVisible(tester, find.byKey(const ValueKey('confirm_cod')));
    expect(find.text('Preview order received'), findsOneWidget);
    expect(f.controller.orders.length, 1);
    expect(f.controller.cart, isEmpty);
    await tapVisible(tester, find.text('All my orders'));
    await tapVisible(tester, find.text('1 L × 1'));
    await tapVisible(tester, find.text('Reorder available packs'));
    expect(f.controller.cart.single.quantity, 1);
    expect(f.controller.orders.length, 1);
    expect(find.text('Your cart'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'Telugu phone flow respects large text dark theme and back navigation',
    (tester) async {
      phoneViewport(tester, width: 360, height: 800);
      tester.platformDispatcher.textScaleFactorTestValue = 1.6;
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      final f = await MobileFixture.create(signedIn: false);
      addTearDown(f.controller.dispose);
      await f.controller.setLanguage('te');
      await tester.pumpWidget(NarayanaApp(controller: f.controller));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.byKey(const ValueKey('home_shop')));
      expect(find.text('మీ ప్యాక్ ఎంచుకోండి'), findsOneWidget);
      await tapVisible(tester, find.text('ప్యాక్ చూడండి').first);
      expect(find.text('వేరుశెనగ నూనె'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('మీ ప్యాక్ ఎంచుకోండి'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('expanded width uses native navigation rail', (tester) async {
    phoneViewport(tester, width: 1000, height: 720);
    final f = await MobileFixture.create(signedIn: false);
    addTearDown(f.controller.dispose);
    await tester.pumpWidget(NarayanaApp(controller: f.controller));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle();
    expect(find.text('Choose your first pack'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('live catalogue failure shows retry and never sample prices', (
    tester,
  ) async {
    phoneViewport(tester);
    final fixture = await MobileFixture.create(signedIn: false);
    fixture.controller.dispose();
    final backend = FailingLiveBackend(fixture.store);
    final controller = AppController(backend, fixture.store);
    addTearDown(controller.dispose);
    await controller.start();
    await flushEvents();
    await tester.pumpWidget(NarayanaApp(controller: controller));
    await tester.pumpAndSettle();
    await tapVisible(tester, find.byKey(const ValueKey('home_shop')));
    expect(find.text('Catalogue could not load'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    expect(find.textContaining('Preview ·'), findsNothing);
    expect(find.text('₹450'), findsNothing);
    expect(controller.catalogue, isNull);
    expect(backend.attempted, isEmpty);
  });
  testWidgets(
    'Firebase private draft labels example prices and pending stock',
    (tester) async {
      phoneViewport(tester);
      final fixture = await MobileFixture.create(signedIn: false);
      fixture.controller.dispose();
      final backend = PrivateDraftTestingBackend(fixture.store);
      final controller = AppController(backend, fixture.store);
      addTearDown(controller.dispose);
      await controller.start();
      await until(() => controller.catalogue != null);
      await tester.pumpWidget(NarayanaApp(controller: controller));
      await tester.pumpAndSettle();
      expect(
        find.text('Private demo · Example prices · Simulated payment only'),
        findsOneWidget,
      );
      await tapVisible(tester, find.byKey(const ValueKey('home_shop')));
      expect(find.text('Example price · ₹450'), findsOneWidget);
      expect(find.text('Example price · ₹900'), findsOneWidget);
      expect(find.text('Example price · ₹2,250'), findsOneWidget);
      expect(find.text('Demo pack · Stock unconfirmed'), findsNWidgets(3));
      expect(controller.orderingAvailable, isFalse);
      expect(controller.checkoutAvailable, isTrue);
      for (final id in ['1l', '2l', '5l']) {
        expect(
          tester
              .widget<FilledButton>(find.byKey(ValueKey('add_$id')))
              .onPressed,
          isNotNull,
        );
      }
      await controller.setLanguage('te');
      await tester.pumpAndSettle();
      expect(find.text('డెమో ప్యాక్ · స్టాక్ నిర్ధారించాలి'), findsNWidgets(3));
      expect(
        find.text('ప్రైవేట్ డెమో · నమూనా ధరలు · చెల్లింపు అనుకరణ మాత్రమే'),
        findsOneWidget,
      );
      expect(backend.attempted, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
}
