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
    expect(find.text('Continue in preview'), findsOneWidget);
    await tapVisible(tester, find.byKey(const ValueKey('sign_in_continue')));
    expect(find.text('Welcome to Narayana Naturals'), findsOneWidget);
    await tapVisible(tester, find.byKey(const ValueKey('welcome_skip')));
    await tapVisible(tester, find.byKey(const ValueKey('preview_address')));
    await tapVisible(tester, find.byKey(const ValueKey('address_review')));
    expect(find.text('Your complete total'), findsOneWidget);
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
}
