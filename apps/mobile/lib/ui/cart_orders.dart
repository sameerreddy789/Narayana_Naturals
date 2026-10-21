import 'dart:async';

import 'package:flutter/material.dart';

import '../domain/failure.dart';
import '../domain/models.dart';
import 'widgets.dart';

String orderStatus(BuildContext context, String status) => switch (status) {
  'packed' => context.tr('Packed', 'ప్యాక్ అయింది'),
  'shipped' => context.tr('Shipped', 'పంపించబడింది'),
  'delivered' => context.tr('Delivered', 'డెలివరీ అయింది'),
  'cancelled' => context.tr('Cancelled', 'రద్దు అయింది'),
  _ => context.tr('Received', 'స్వీకరించబడింది'),
};
String orderDate(DateTime value) {
  final date = value.toLocal();
  return '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
}

String lineDescription(List<OrderLine> lines) =>
    lines.map((line) => '${line.litres} L × ${line.quantity}').join(' · ');

class CartPage extends StatelessWidget {
  const CartPage({
    super.key,
    required this.onShop,
    required this.onCheckout,
    required this.onOrders,
  });
  final VoidCallback onShop, onCheckout, onOrders;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return PageBody(
      children: [
        PageTitle(context.tr('Your cart', 'మీ కార్ట్')),
        GuideCard(
          page: 'cart',
          title: context.tr(
            'Review packs before delivery',
            'డెలివరీకి ముందు ప్యాక్‌లను సమీక్షించండి',
          ),
          body: context.tr(
            'Change quantities with + and −. Your product total is an estimate until the store checks your delivery PIN and current stock.',
            '+, − తో సంఖ్య మార్చండి. డెలివరీ పిన్, తాజా స్టాక్ తనిఖీ అయ్యే వరకు ఉత్పత్తుల మొత్తం అంచనా మాత్రమే.',
          ),
        ),
        if (app.pending != null)
          PendingCheckoutPanel(onReview: onCheckout, onOrders: onOrders),
        if (app.accountLoading)
          LoadingState(
            label: context.tr(
              'Loading your saved cart…',
              'మీ సేవ్ చేసిన కార్ట్ లోడ్ అవుతోంది…',
            ),
          ),
        if (app.accountError != null)
          FailurePanel(
            error: app.accountError!,
            onRetry: () => unawaited(app.retryAccount()),
          ),
        if (app.cartError != null)
          FailurePanel(
            error: app.cartError!,
            title: context.tr(
              'Cart changes need syncing',
              'కార్ట్ మార్పులను సేవ్ చేయాలి',
            ),
            onRetry: () => unawaited(
              perform(
                context,
                app.pending?.orderId != null
                    ? app.finishCompletedCheckout
                    : app.syncCart,
              ),
            ),
          ),
        if (app.cart.isEmpty && !app.accountLoading)
          EmptyState(
            icon: Icons.shopping_bag_outlined,
            title: context.tr(
              'Choose your first pack',
              'మీ మొదటి ప్యాక్ ఎంచుకోండి',
            ),
            body: context.tr(
              'Add 1, 2 or 5 litre packs of groundnut oil.',
              '1, 2 లేదా 5 లీటర్ వేరుశెనగ నూనె ప్యాక్‌లను జోడించండి.',
            ),
            action: FilledButton(
              onPressed: onShop,
              child: Text(context.tr('Browse packs', 'ప్యాక్‌లు చూడండి')),
            ),
          ),
        if (app.cart.isNotEmpty) ...[
          if (app.catalogue == null) const CatalogueStatus(),
          for (final line in app.cart) _CartRow(line: line),
          TotalRow(
            app.privateDraft
                ? context.tr('Example product total', 'నమూనా ఉత్పత్తుల మొత్తం')
                : context.tr(
                    'Estimated product total',
                    'ఉత్పత్తుల అంచనా మొత్తం',
                  ),
            money(app.estimatedSubtotal),
            strong: true,
          ),
          TotalRow(
            context.tr('Delivery', 'డెలివరీ'),
            context.tr('Check with your PIN', 'మీ పిన్‌తో తనిఖీ చేయండి'),
          ),
          const SizedBox(height: 12),
          Text(
            app.signedIn
                ? app.cartDirty
                      ? context.tr(
                          'Saving your cart…',
                          'మీ కార్ట్ సేవ్ అవుతోంది…',
                        )
                      : context.tr(
                          'Your cart syncs with your email account.',
                          'మీ కార్ట్ మీ ఈమెయిల్ ఖాతాతో సేవ్ అవుతుంది.',
                        )
                : context.tr(
                    'Saved on this device. Sign in at checkout to save it to your email account.',
                    'ఈ పరికరంలో సేవ్ అయింది. ఈమెయిల్ ఖాతాలో సేవ్ చేయడానికి చెక్అవుట్‌లో సైన్ ఇన్ చేయండి.',
                  ),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 24),
          BusyButton(
            key: const ValueKey('cart_checkout'),
            label: context.tr(
              app.signedIn ? 'Delivery & total' : 'Sign in & checkout',
              app.signedIn ? 'డెలివరీ, మొత్తం' : 'సైన్ ఇన్ చేసి ఆర్డర్ చేయండి',
            ),
            onPressed:
                app.orderingAvailable &&
                    (!app.signedIn || app.accountReady) &&
                    app.pending?.orderId == null
                ? onCheckout
                : null,
            busy: app.checkoutBusy,
            icon: Icons.arrow_forward,
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: onShop,
            child: Text(
              context.tr('Continue shopping', 'షాపింగ్ కొనసాగించండి'),
            ),
          ),
        ],
      ],
    );
  }
}

class _CartRow extends StatelessWidget {
  const _CartRow({required this.line});
  final CartLine line;
  @override
  Widget build(BuildContext context) {
    final app = context.app, variant = context.app.catalogue?.variant(line.id);
    final litres = variant?.litres ?? int.parse(line.id[0]);
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 76,
                child: PackArtwork(litres: litres, compact: true),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr('$litres litre pack', '$litres లీటర్ ప్యాక్'),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      variant == null
                          ? context.tr('Price is loading', 'ధర లోడ్ అవుతోంది')
                          : '${app.privateDraft ? '${context.tr('Example price', 'నమూనా ధర')} · ' : ''}${money(variant.pricePaise)} × ${line.quantity}',
                    ),
                    if (variant != null &&
                        (!variant.available ||
                            line.quantity > variant.stock)) ...[
                      const SizedBox(height: 8),
                      Text(
                        app.privateDraft && !variant.stockConfirmed
                            ? context.tr(
                                'Stock pending',
                                'స్టాక్ నిర్ధారించాలి',
                              )
                            : context.tr(
                                'Update quantity: this pack is unavailable or stock is lower.',
                                'సంఖ్య మార్చండి: ప్యాక్ అందుబాటులో లేదు లేదా స్టాక్ తక్కువగా ఉంది.',
                              ),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            alignment: WrapAlignment.spaceBetween,
            children: [
              QuantityStepper(
                id: line.id,
                quantity: line.quantity,
                maximum: variant?.quantityLimit ?? line.quantity,
                enabled: app.canEditCart,
              ),
              TextButton(
                onPressed: app.canEditCart
                    ? () => unawaited(
                        perform(context, () => app.setQuantity(line.id, 0)),
                      )
                    : null,
                child: Text(context.tr('Remove', 'తొలగించండి')),
              ),
            ],
          ),
          const Divider(),
        ],
      ),
    );
  }
}

class PendingCheckoutPanel extends StatelessWidget {
  const PendingCheckoutPanel({
    super.key,
    required this.onReview,
    required this.onOrders,
  });
  final VoidCallback onReview, onOrders;
  @override
  Widget build(BuildContext context) {
    final app = context.app, value = context.app.pending!;
    final completed = value.orderId != null;
    final rejected = value.definitivelyRejected;
    final title = completed
        ? context.tr('Your order was received', 'మీ ఆర్డర్ స్వీకరించబడింది')
        : rejected
        ? context.tr('Review checkout again', 'చెక్అవుట్‌ను మళ్లీ సమీక్షించండి')
        : value.attempted
        ? context.tr(
            'Check your order result',
            'మీ ఆర్డర్ ఫలితాన్ని తనిఖీ చేయండి',
          )
        : context.tr(
            'Your delivery total is ready',
            'మీ డెలివరీ మొత్తం సిద్ధంగా ఉంది',
          );
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Text(
            completed
                ? context.tr(
                    'Order ${value.orderId}. Finish saving your cart before placing another order.',
                    'ఆర్డర్ ${value.orderId}. మరో ఆర్డర్‌కు ముందు కార్ట్ సేవ్ చేయడం పూర్తి చేయండి.',
                  )
                : rejected
                ? AppFailure(value.rejectionCode!).message(app.language)
                : value.attempted
                ? context.tr(
                    'Retry checks the original order, with the same packs and delivery address. It will not place the same order twice.',
                    'మళ్లీ ప్రయత్నిస్తే అదే ప్యాక్‌లు, చిరునామాతో మొదటి ఆర్డర్ ఫలితం తనిఖీ అవుతుంది. ఒకే ఆర్డర్ రెండుసార్లు రాదు.',
                  )
                : context.tr(
                    'Continue to review ${money(value.quote.totalPaise)} for PIN ${value.address.pin}.',
                    'పిన్ ${value.address.pin} కోసం ${money(value.quote.totalPaise)} సమీక్షించండి.',
                  ),
          ),
          const SizedBox(height: 16),
          BusyButton(
            label: completed
                ? context.tr(
                    'Finish cart sync',
                    'కార్ట్ సేవ్ చేయడం పూర్తి చేయండి',
                  )
                : context.tr(
                    value.attempted ? 'Review original order' : 'Review total',
                    value.attempted
                        ? 'మొదటి ఆర్డర్ సమీక్షించండి'
                        : 'మొత్తం సమీక్షించండి',
                  ),
            busy: app.checkoutBusy,
            onPressed: app.accountReady
                ? completed
                      ? () => unawaited(
                          perform(context, app.finishCompletedCheckout),
                        )
                      : onReview
                : null,
          ),
          if (completed)
            TextButton(
              onPressed: onOrders,
              child: Text(context.tr('View orders', 'ఆర్డర్‌లు చూడండి')),
            ),
        ],
      ),
    );
  }
}

class OrdersPage extends StatelessWidget {
  const OrdersPage({
    super.key,
    required this.onSignIn,
    required this.onShop,
    required this.onDetail,
  });
  final VoidCallback onSignIn, onShop;
  final ValueChanged<String> onDetail;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return PageBody(
      children: [
        PageTitle(context.tr('Your orders', 'మీ ఆర్డర్‌లు')),
        GuideCard(
          page: 'orders',
          title: context.tr(
            'Your purchases in one place',
            'మీ కొనుగోళ్లు ఒకే చోట',
          ),
          body: context.tr(
            'Tap an order to see its delivery address and status. Reorder adds the available packs to your cart at current prices.',
            'చిరునామా, స్థితి కోసం ఆర్డర్‌ను తెరవండి. మళ్లీ కొనుగోలు చేస్తే ప్రస్తుతం అందుబాటులో ఉన్న ప్యాక్‌లు తాజా ధరలకు కార్ట్‌లో చేరతాయి.',
          ),
        ),
        if (!app.signedIn)
          EmptyState(
            icon: Icons.receipt_long_outlined,
            title: context.tr(
              'Sign in to see your orders',
              'మీ ఆర్డర్‌ల కోసం సైన్ ఇన్ చేయండి',
            ),
            body: context.tr(
              'Use the same email on the website and app to find all your orders.',
              'అన్ని ఆర్డర్‌ల కోసం వెబ్‌సైట్, యాప్‌లో ఒకే ఫోన్ ఉపయోగించండి.',
            ),
            action: FilledButton(
              onPressed: onSignIn,
              child: Text(context.tr('Sign in', 'సైన్ ఇన్')),
            ),
          ),
        if (app.accountLoading)
          LoadingState(
            label: context.tr(
              'Loading your orders…',
              'మీ ఆర్డర్‌లు లోడ్ అవుతున్నాయి…',
            ),
          ),
        if (app.accountError != null)
          FailurePanel(
            error: app.accountError!,
            onRetry: () => unawaited(app.retryAccount()),
          ),
        if (app.accountReady && app.orders.isEmpty)
          EmptyState(
            icon: Icons.receipt_long_outlined,
            title: context.tr(
              'Your first order starts here',
              'మీ మొదటి ఆర్డర్ ఇక్కడ ప్రారంభమవుతుంది',
            ),
            body: context.tr(
              'Choose a pack and review delivery. Confirmed orders will appear here.',
              'ప్యాక్ ఎంచుకుని డెలివరీ సమీక్షించండి. ధృవీకరించిన ఆర్డర్‌లు ఇక్కడ కనిపిస్తాయి.',
            ),
            action: FilledButton(
              onPressed: onShop,
              child: Text(context.tr('Browse packs', 'ప్యాక్‌లు చూడండి')),
            ),
          ),
        for (final order in app.orders) ...[
          ListTile(
            contentPadding: const EdgeInsets.symmetric(vertical: 12),
            minVerticalPadding: 16,
            title: Text(
              lineDescription(order.lines),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${orderDate(order.createdAt)} · ${money(order.totalPaise)}',
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${order.preview ? '${context.tr('Preview', 'ప్రివ్యూ')} · ' : ''}${orderStatus(context, order.status)}',
                  ),
                ],
              ),
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onDetail(order.id),
          ),
          const Divider(),
        ],
        if (app.orders.length >= 50)
          Text(
            context.tr(
              'Showing your 50 most recent orders. Contact the store for an older order.',
              'మీ తాజా 50 ఆర్డర్‌లు చూపుతున్నాం. పాత ఆర్డర్ కోసం స్టోర్‌ను సంప్రదించండి.',
            ),
          ),
      ],
    );
  }
}

class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({
    super.key,
    required this.orderId,
    required this.onReordered,
  });
  final String orderId;
  final VoidCallback onReordered;
  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  Future<OrderRecord>? future;
  String? owner;
  bool busy = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = context.app;
    if (owner != app.user?.uid || future == null) {
      owner = app.user?.uid;
      future = app.signedIn ? app.loadOrder(widget.orderId) : null;
    }
  }

  void reload() =>
      setState(() => future = context.app.loadOrder(widget.orderId));
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    OrderRecord? current;
    for (final order in app.orders) {
      if (order.id == widget.orderId) current = order;
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('Order details', 'ఆర్డర్ వివరాలు')),
      ),
      body: SafeArea(
        child: !app.signedIn
            ? PageBody(
                children: [
                  PageTitle(
                    context.tr(
                      'Sign in to view this order',
                      'ఈ ఆర్డర్ కోసం సైన్ ఇన్ చేయండి',
                    ),
                  ),
                ],
              )
            : FutureBuilder<OrderRecord>(
                future: future,
                builder: (context, snapshot) {
                  final order = current ?? snapshot.data;
                  if (order == null) {
                    return PageBody(
                      children: [
                        if (snapshot.hasError)
                          FailurePanel(
                            error: AppFailure.from(snapshot.error!),
                            onRetry: reload,
                          )
                        else
                          LoadingState(
                            label: context.tr(
                              'Loading order details…',
                              'ఆర్డర్ వివరాలు లోడ్ అవుతున్నాయి…',
                            ),
                          ),
                      ],
                    );
                  }
                  if (order.uid != app.user?.uid) {
                    return const SizedBox.shrink();
                  }
                  return PageBody(
                    children: [
                      if (order.preview)
                        Text(
                          context.tr(
                            'Preview order · No payment or delivery will occur.',
                            'ప్రివ్యూ ఆర్డర్ · చెల్లింపు లేదా డెలివరీ జరగదు.',
                          ),
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      const SizedBox(height: 16),
                      Text(
                        orderStatus(context, order.status),
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 12),
                      SelectableText(order.id),
                      Text(orderDate(order.createdAt)),
                      const SizedBox(height: 24),
                      for (final line in order.lines)
                        TotalRow(
                          '${line.litres} L × ${line.quantity}',
                          money(line.totalPaise),
                        ),
                      const Divider(),
                      TotalRow(
                        context.tr('Products', 'ఉత్పత్తులు'),
                        money(order.subtotalPaise),
                      ),
                      TotalRow(
                        context.tr('Delivery', 'డెలివరీ'),
                        money(order.shippingPaise),
                      ),
                      TotalRow(
                        context.tr('Order total', 'ఆర్డర్ మొత్తం'),
                        money(order.totalPaise),
                        strong: true,
                      ),
                      const SizedBox(height: 12),
                      Text(switch (order.paymentStatus) {
                        'collected' => context.tr(
                          'Cash on delivery · Collected',
                          'డెలివరీ సమయంలో నగదు · తీసుకున్నారు',
                        ),
                        'cancelled' => context.tr(
                          'Payment cancelled',
                          'చెల్లింపు రద్దు అయింది',
                        ),
                        _ => context.tr(
                          'Cash on delivery · Pay when delivered',
                          'డెలివరీ సమయంలో నగదు చెల్లించండి',
                        ),
                      }),
                      const SizedBox(height: 28),
                      Text(
                        context.tr('Delivery address', 'డెలివరీ చిరునామా'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      Text(order.address.name),
                      Text(order.address.summary),
                      Text('+91 ${order.address.phone}'),
                      const SizedBox(height: 28),
                      Text(
                        context.tr('Order progress', 'ఆర్డర్ పురోగతి'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      if (order.status == 'cancelled')
                        Text(
                          context.tr(
                            'The store cancelled this order.',
                            'స్టోర్ ఈ ఆర్డర్‌ను రద్దు చేసింది.',
                          ),
                        )
                      else
                        ...['received', 'packed', 'shipped', 'delivered'].map((
                          status,
                        ) {
                          final done =
                              [
                                'received',
                                'packed',
                                'shipped',
                                'delivered',
                              ].indexOf(status) <=
                              [
                                'received',
                                'packed',
                                'shipped',
                                'delivered',
                              ].indexOf(order.status);
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Row(
                              children: [
                                Icon(
                                  done
                                      ? Icons.check_circle_outline
                                      : Icons.radio_button_unchecked,
                                  color: done
                                      ? Theme.of(context).colorScheme.primary
                                      : Theme.of(context).colorScheme.outline,
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Text(orderStatus(context, status)),
                                ),
                              ],
                            ),
                          );
                        }),
                      const SizedBox(height: 24),
                      BusyButton(
                        label: context.tr(
                          'Reorder available packs',
                          'అందుబాటులో ఉన్న ప్యాక్‌లను మళ్లీ కొనండి',
                        ),
                        busy: busy,
                        onPressed: app.canEditCart
                            ? () async {
                                setState(() => busy = true);
                                try {
                                  final unavailable = await app.reorder(order);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          unavailable > 0
                                              ? context.tr(
                                                  'Available packs added. Some quantities changed with current stock.',
                                                  'లభ్యమైన ప్యాక్‌లు జోడించబడ్డాయి. తాజా స్టాక్‌తో కొన్ని సంఖ్యలు మారాయి.',
                                                )
                                              : context.tr(
                                                  'Packs added at current prices. Review delivery in your cart.',
                                                  'తాజా ధరలకు ప్యాక్‌లు జోడించబడ్డాయి. కార్ట్‌లో డెలివరీ సమీక్షించండి.',
                                                ),
                                        ),
                                      ),
                                    );
                                    widget.onReordered();
                                  }
                                } catch (error) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          AppFailure.from(
                                            error,
                                          ).message(app.language),
                                        ),
                                      ),
                                    );
                                  }
                                } finally {
                                  if (mounted) setState(() => busy = false);
                                }
                              }
                            : null,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        context.tr(
                          'Reordering creates a new cart; it does not repeat a payment or confirm another order.',
                          'మళ్లీ కొనుగోలు కొత్త కార్ట్‌ను సిద్ధం చేస్తుంది; మరో చెల్లింపు లేదా ఆర్డర్‌ను ధృవీకరించదు.',
                        ),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  );
                },
              ),
      ),
    );
  }
}
