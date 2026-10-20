import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../app_controller.dart';
import '../domain/models.dart';
import 'account_pages.dart';
import 'auth_checkout.dart';
import 'cart_orders.dart';
import 'catalogue_pages.dart';
import 'theme.dart';
import 'widgets.dart';

class NarayanaApp extends StatelessWidget {
  const NarayanaApp({super.key, required this.controller});
  final AppController controller;
  @override
  Widget build(BuildContext context) => AppScope(
    controller: controller,
    child: ListenableBuilder(
      listenable: controller,
      builder: (context, _) => MaterialApp(
        title: 'Narayana Naturals',
        debugShowCheckedModeBanner: false,
        locale: Locale(controller.language),
        supportedLocales: const [Locale('en'), Locale('te')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: brandTheme(dark: false, language: controller.language),
        darkTheme: brandTheme(dark: true, language: controller.language),
        themeMode: ThemeMode.system,
        home: const CustomerShell(),
      ),
    ),
  );
}

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});
  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int selected = 0;
  final _welcomed = <String>{};
  Future<void>? _welcome;
  bool routing = false;
  void select(int value) {
    ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
    if (mounted) setState(() => selected = value);
  }

  Future<T?> push<T>(Widget page) {
    ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
    return Navigator.of(
      context,
    ).push<T>(MaterialPageRoute(builder: (_) => page));
  }

  void replace(Widget page) {
    ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => page));
  }

  void info(InfoTopic topic) => unawaited(push(InfoPage(topic: topic)));
  Future<void> welcomeIfNeeded() async {
    final app = context.app, uid = context.app.user?.uid;
    if (_welcome != null) return _welcome;
    if (!app.accountReady ||
        app.guide.welcomeSeen ||
        uid == null ||
        _welcomed.contains(uid)) {
      return;
    }
    _welcomed.add(uid);
    _welcome = push(const WelcomePage()).then((_) {});
    try {
      await _welcome;
    } finally {
      _welcome = null;
    }
  }

  Future<bool> signIn() async {
    final result = await push<bool>(const SignInPage());
    if (!mounted) return false;
    if (result == true) await welcomeIfNeeded();
    return result == true;
  }

  Future<void> checkout() async {
    if (routing) return;
    routing = true;
    try {
      if (!context.app.signedIn && !await signIn()) return;
      if (!mounted || !context.app.accountReady) return;
      await welcomeIfNeeded();
      if (!mounted) return;
      final pending = context.app.pending;
      await push(pending != null ? reviewPage(pending) : addressPage());
    } finally {
      routing = false;
    }
  }

  Widget addressPage({bool checkout = true}) => AddressPage(
    checkout: checkout,
    onSaved: () => Navigator.of(context).pop(),
    onQuoted: (value) => replace(reviewPage(value)),
  );
  Widget reviewPage(PendingCheckout value) => ReviewCheckoutPage(
    checkout: value,
    onNewQuote: () => replace(addressPage()),
    onConfirmed: (id, checkout) => replace(
      OrderConfirmationPage(
        orderId: id,
        checkout: checkout,
        onOrders: () {
          Navigator.of(context).popUntil((route) => route.isFirst);
          select(3);
        },
        onDetail: () => replace(
          OrderDetailPage(
            orderId: id,
            onReordered: () {
              Navigator.of(context).popUntil((route) => route.isFirst);
              select(2);
            },
          ),
        ),
      ),
    ),
  );
  void product(String id) => unawaited(
    push(
      ProductPage(
        initialVariant: id,
        onCart: () {
          Navigator.of(context).pop();
          select(2);
        },
      ),
    ),
  );
  void order(String id) => unawaited(
    push(
      OrderDetailPage(
        orderId: id,
        onReordered: () {
          Navigator.of(context).pop();
          select(2);
        },
      ),
    ),
  );
  Future<void> replay() async {
    await perform(context, () async {
      await context.app.replayGuides();
      if (!mounted) return;
      _welcomed.remove(context.app.user?.uid);
      await welcomeIfNeeded();
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    if (!routing &&
        _welcome == null &&
        app.accountReady &&
        !app.guide.welcomeSeen &&
        ModalRoute.of(context)?.isCurrent == true &&
        !_welcomed.contains(app.user?.uid)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !routing && ModalRoute.of(context)?.isCurrent == true) {
          unawaited(welcomeIfNeeded());
        }
      });
    }
    final labels = [
      context.tr('Home', 'హోమ్'),
      context.tr('Shop', 'షాప్'),
      context.tr('Cart', 'కార్ట్'),
      context.tr('Orders', 'ఆర్డర్‌లు'),
      context.tr('Account', 'ఖాతా'),
    ];
    final icons = [
      Icons.home_outlined,
      Icons.shopping_bag_outlined,
      Icons.shopping_cart_outlined,
      Icons.receipt_long_outlined,
      Icons.person_outline,
    ];
    final selectedIcons = [
      Icons.home,
      Icons.shopping_bag,
      Icons.shopping_cart,
      Icons.receipt_long,
      Icons.person,
    ];
    final pages = [
      HomePage(
        onShop: () => select(1),
        onStory: () => info(InfoTopic.story),
        onOrders: () => select(3),
      ),
      ShopPage(onProduct: product),
      CartPage(
        onShop: () => select(1),
        onCheckout: () => unawaited(checkout()),
        onOrders: () => select(3),
      ),
      OrdersPage(
        onSignIn: () => unawaited(signIn()),
        onShop: () => select(1),
        onDetail: order,
      ),
      AccountPage(
        onSignIn: () => unawaited(signIn()),
        onAddress: () => unawaited(push(addressPage(checkout: false))),
        onName: () => unawaited(push(const NamePage())),
        onReplay: () => unawaited(replay()),
        onInfo: info,
      ),
    ];
    Widget icon(int index, {bool active = false}) {
      final symbol = Icon(active ? selectedIcons[index] : icons[index]);
      if (index != 2 || app.packCount == 0) return symbol;
      return Badge(label: Text('${app.packCount}'), child: symbol);
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final expanded = constraints.maxWidth >= 840;
        return Scaffold(
          appBar: AppBar(
            title: const BrandLogo(width: 180),
            actions: [
              PopupMenuButton<String>(
                tooltip: context.tr('Change language', 'భాష మార్చండి'),
                onSelected: (value) =>
                    unawaited(perform(context, () => app.setLanguage(value))),
                itemBuilder: (_) => [
                  CheckedPopupMenuItem(
                    value: 'en',
                    checked: app.language == 'en',
                    child: const Text('English'),
                  ),
                  CheckedPopupMenuItem(
                    value: 'te',
                    checked: app.language == 'te',
                    child: const Text('తెలుగు'),
                  ),
                ],
                icon: const Icon(Icons.translate),
              ),
              IconButton(
                tooltip: context.tr('Help', 'సహాయం'),
                onPressed: () => info(InfoTopic.help),
                icon: const Icon(Icons.help_outline),
              ),
              const SizedBox(width: 8),
            ],
          ),
          body: SafeArea(
            bottom: expanded,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const ModeBanner(),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (expanded) ...[
                        NavigationRail(
                          selectedIndex: selected,
                          onDestinationSelected: select,
                          extended: constraints.maxWidth >= 1100,
                          labelType: constraints.maxWidth >= 1100
                              ? NavigationRailLabelType.none
                              : NavigationRailLabelType.all,
                          destinations: List.generate(
                            5,
                            (index) => NavigationRailDestination(
                              icon: icon(index),
                              selectedIcon: icon(index, active: true),
                              label: Text(labels[index]),
                            ),
                          ),
                        ),
                        const VerticalDivider(width: 1),
                      ],
                      Expanded(
                        child: KeyedSubtree(
                          key: ValueKey(selected),
                          child: pages[selected],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: expanded
              ? null
              : NavigationBar(
                  height: max(
                    80,
                    MediaQuery.textScalerOf(context).scale(14) * 2 + 48,
                  ),
                  selectedIndex: selected,
                  onDestinationSelected: select,
                  destinations: List.generate(
                    5,
                    (index) => NavigationDestination(
                      key: ValueKey('tab_$index'),
                      icon: icon(index),
                      selectedIcon: icon(index, active: true),
                      label: labels[index],
                    ),
                  ),
                ),
        );
      },
    );
  }
}
