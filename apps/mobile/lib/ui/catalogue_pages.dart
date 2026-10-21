import 'dart:async';

import 'package:flutter/material.dart';

import '../domain/models.dart';
import 'widgets.dart';

class HomePage extends StatelessWidget {
  const HomePage({
    super.key,
    required this.onShop,
    required this.onStory,
    required this.onOrders,
  });
  final VoidCallback onShop, onStory, onOrders;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return PageBody(
      children: [
        GuideCard(
          page: 'home',
          title: context.tr(
            'A quick way to your next pack',
            'మీ తదుపరి ప్యాక్‌కు సులభమైన మార్గం',
          ),
          body: context.tr(
            'Use Shop to choose 1, 2 or 5 litres. Your cart holds the packs while you check delivery. Find repeat purchases in Orders.',
            'షాప్‌లో 1, 2 లేదా 5 లీటర్లు ఎంచుకోండి. డెలివరీ తనిఖీ చేసే వరకు ప్యాక్‌లు కార్ట్‌లో ఉంటాయి. మళ్లీ కొనడానికి ఆర్డర్‌లను చూడండి.',
          ),
        ),
        LayoutBuilder(
          builder: (context, constraints) {
            final copy = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.tr(
                    'Groundnut oil, the wooden Ghani way.',
                    'చెక్క గానుగ పద్ధతిలో వేరుశెనగ నూనె.',
                  ),
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 16),
                Text(
                  context.tr(
                    'Narayana Naturals makes groundnut oil with a traditional bull-driven wooden Ghani.',
                    'నారాయణ నేచురల్స్ సాంప్రదాయ ఎద్దుతో నడిచే చెక్క గానుగలో వేరుశెనగ నూనె తయారు చేస్తుంది.',
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  key: const ValueKey('home_shop'),
                  onPressed: onShop,
                  icon: const Icon(Icons.shopping_bag_outlined),
                  label: Text(context.tr('Choose a pack', 'ప్యాక్ ఎంచుకోండి')),
                ),
              ],
            );
            if (constraints.maxWidth >= 600) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(flex: 3, child: copy),
                  const SizedBox(width: 24),
                  const Expanded(flex: 2, child: PackArtwork(litres: 2)),
                ],
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                copy,
                const SizedBox(height: 28),
                const PackArtwork(litres: 2),
              ],
            );
          },
        ),
        const SizedBox(height: 32),
        const CatalogueStatus(),
        if (app.catalogue?.published == true) ...[
          Text(
            context.tr(
              'One oil. Three pack sizes.',
              'ఒక నూనె. మూడు ప్యాక్ పరిమాణాలు.',
            ),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: app.catalogue!.variants
                .map(
                  (variant) => ActionChip(
                    label: Text(
                      '${variant.litres} L · ${money(variant.pricePaise)}',
                    ),
                    onPressed: onShop,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 10,
                    ),
                  ),
                )
                .toList(),
          ),
        ],
        const SizedBox(height: 28),
        ListTile(
          contentPadding: EdgeInsets.zero,
          minVerticalPadding: 16,
          title: Text(
            context.tr('The wooden Ghani process', 'చెక్క గానుగ పద్ధతి'),
          ),
          subtitle: Text(
            context.tr(
              'Read the product’s story and ingredients.',
              'ఉత్పత్తి కథ, పదార్థాలను చదవండి.',
            ),
          ),
          trailing: const Icon(Icons.arrow_forward),
          onTap: onStory,
        ),
        const Divider(),
        ListTile(
          contentPadding: EdgeInsets.zero,
          minVerticalPadding: 16,
          title: Text(context.tr('Buying again?', 'మళ్లీ కొనాలనుకుంటున్నారా?')),
          subtitle: Text(
            context.tr(
              'Your website and app orders share one email account.',
              'వెబ్‌సైట్, యాప్ ఆర్డర్‌లు ఒకే ఈమెయిల్ ఖాతాలో ఉంటాయి.',
            ),
          ),
          trailing: const Icon(Icons.arrow_forward),
          onTap: onOrders,
        ),
      ],
    );
  }
}

class ShopPage extends StatelessWidget {
  const ShopPage({super.key, required this.onProduct});
  final ValueChanged<String> onProduct;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return PageBody(
      children: [
        PageTitle(
          context.tr('Choose your pack', 'మీ ప్యాక్ ఎంచుకోండి'),
          description: context.tr(
            'Groundnut oil in 1, 2 and 5 litre packs.',
            '1, 2, 5 లీటర్ ప్యాక్‌లలో వేరుశెనగ నూనె.',
          ),
        ),
        GuideCard(
          page: 'shop',
          title: context.tr(
            'Pick a size, then a quantity',
            'పరిమాణం, తర్వాత సంఖ్య ఎంచుకోండి',
          ),
          body: context.tr(
            'View a pack for ingredients and storage details. Add packs here; delivery charges appear after you enter your PIN.',
            'పదార్థాలు, నిల్వ వివరాల కోసం ప్యాక్‌ను చూడండి. ఇక్కడ ప్యాక్‌లు జోడించండి; పిన్ నమోదు చేసిన తర్వాత డెలివరీ ఛార్జీలు కనిపిస్తాయి.',
          ),
        ),
        const CatalogueStatus(),
        if (app.catalogue?.published == true)
          ...app.catalogue!.variants.map(
            (variant) => _PackRow(
              variant: variant,
              onProduct: () => onProduct(variant.id),
            ),
          ),
        if (app.catalogue?.published == true && app.catalogue!.variants.isEmpty)
          EmptyState(
            icon: Icons.inventory_2_outlined,
            title: context.tr(
              'No packs available yet',
              'ప్యాక్‌లు ఇంకా అందుబాటులో లేవు',
            ),
            body: context.tr(
              'Please check back when the store publishes pack prices.',
              'స్టోర్ ప్యాక్ ధరలను ప్రచురించిన తర్వాత మళ్లీ చూడండి.',
            ),
          ),
      ],
    );
  }
}

class _PackRow extends StatelessWidget {
  const _PackRow({required this.variant, required this.onProduct});
  final Variant variant;
  final VoidCallback onProduct;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final count = app.quantity(variant.id);
    return Padding(
      padding: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 110,
                child: PackArtwork(litres: variant.litres, compact: true),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr(
                        '${variant.litres} litre pack',
                        '${variant.litres} లీటర్ ప్యాక్',
                      ),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      app.preview
                          ? '${context.tr('Example price', 'నమూనా ధర')} · ${money(variant.pricePaise)}'
                          : money(variant.pricePaise),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      app.privateDraft && !variant.stockConfirmed
                          ? context.tr('Stock pending', 'స్టాక్ నిర్ధారించాలి')
                          : variant.available
                          ? context.tr('Available', 'అందుబాటులో ఉంది')
                          : context.tr('Unavailable', 'అందుబాటులో లేదు'),
                      style: TextStyle(
                        color: variant.available
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton(
                onPressed: onProduct,
                child: Text(context.tr('View pack', 'ప్యాక్ చూడండి')),
              ),
              if (count > 0)
                QuantityStepper(
                  id: variant.id,
                  quantity: count,
                  maximum: variant.quantityLimit,
                  enabled: app.canEditCart,
                )
              else
                FilledButton.icon(
                  key: ValueKey('add_${variant.id}'),
                  onPressed: variant.available && app.canEditCart
                      ? () => unawaited(
                          perform(
                            context,
                            () => app.add(variant.id),
                            success: context.tr(
                              'Pack added to your cart',
                              'ప్యాక్ మీ కార్ట్‌కు జోడించబడింది',
                            ),
                          ),
                        )
                      : null,
                  icon: const Icon(Icons.add_shopping_cart_outlined),
                  label: Text(context.tr('Add to cart', 'కార్ట్‌కు జోడించండి')),
                ),
            ],
          ),
          const Divider(),
        ],
      ),
    );
  }
}

class ProductPage extends StatefulWidget {
  const ProductPage({
    super.key,
    required this.initialVariant,
    required this.onCart,
  });
  final String initialVariant;
  final VoidCallback onCart;
  @override
  State<ProductPage> createState() => _ProductPageState();
}

class _ProductPageState extends State<ProductPage> {
  late String selected = widget.initialVariant;
  bool busy = false;
  @override
  Widget build(BuildContext context) {
    final app = context.app, product = context.app.catalogue?.product;
    final variant = app.catalogue?.variant(selected);
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('Groundnut oil', 'వేరుశెనగ నూనె'))),
      body: SafeArea(
        child: PageBody(
          children: [
            const ModeBanner(),
            const SizedBox(height: 16),
            GuideCard(
              page: 'product',
              title: context.tr(
                'Everything about this pack',
                'ఈ ప్యాక్ గురించి వివరాలు',
              ),
              body: context.tr(
                'Switch sizes to compare prices. Ingredients and storage are below. View cart when you are ready to check delivery.',
                'ధరలను పోల్చడానికి పరిమాణం మార్చండి. పదార్థాలు, నిల్వ వివరాలు కింద ఉన్నాయి. డెలివరీ కోసం కార్ట్‌ను చూడండి.',
              ),
            ),
            const CatalogueStatus(),
            if (product != null && variant != null) ...[
              PackArtwork(litres: variant.litres),
              const SizedBox(height: 24),
              Text(
                product.name.inLanguage(app.language),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              Text(product.description.inLanguage(app.language)),
              const SizedBox(height: 24),
              SegmentedButton<String>(
                showSelectedIcon: false,
                segments: variantIds
                    .map(
                      (id) => ButtonSegment(
                        value: id,
                        label: Text(
                          '${app.catalogue!.variant(id)?.litres ?? int.parse(id[0])} L',
                        ),
                      ),
                    )
                    .toList(),
                selected: {selected},
                onSelectionChanged: (values) =>
                    setState(() => selected = values.first),
              ),
              const SizedBox(height: 24),
              TotalRow(
                app.preview
                    ? context.tr('Example price', 'నమూనా ధర')
                    : context.tr('Price per pack', 'ఒక ప్యాక్ ధర'),
                money(variant.pricePaise),
                strong: true,
              ),
              Text(
                app.privateDraft && !variant.stockConfirmed
                    ? context.tr('Stock pending', 'స్టాక్ నిర్ధారించాలి')
                    : variant.available
                    ? context.tr(
                        'Available · Delivery checked at checkout',
                        'అందుబాటులో ఉంది · చెక్అవుట్‌లో డెలివరీ తనిఖీ',
                      )
                    : context.tr(
                        'This pack is currently unavailable',
                        'ఈ ప్యాక్ ఇప్పుడు అందుబాటులో లేదు',
                      ),
              ),
              const SizedBox(height: 20),
              if (app.quantity(selected) > 0)
                Align(
                  alignment: Alignment.centerLeft,
                  child: QuantityStepper(
                    id: selected,
                    quantity: app.quantity(selected),
                    maximum: variant.quantityLimit,
                    enabled: app.canEditCart,
                  ),
                ),
              const SizedBox(height: 12),
              BusyButton(
                label: context.tr(
                  'Add a pack to cart',
                  'ప్యాక్‌ను కార్ట్‌కు జోడించండి',
                ),
                busy: busy,
                icon: Icons.add_shopping_cart_outlined,
                onPressed:
                    variant.available &&
                        app.canEditCart &&
                        app.quantity(selected) < variant.quantityLimit
                    ? () async {
                        setState(() => busy = true);
                        await perform(
                          context,
                          () => app.add(selected),
                          success: context.tr(
                            'Pack added to your cart',
                            'ప్యాక్ కార్ట్‌కు జోడించబడింది',
                          ),
                        );
                        if (mounted) setState(() => busy = false);
                      }
                    : null,
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: widget.onCart,
                child: Text(context.tr('View cart', 'కార్ట్ చూడండి')),
              ),
              const SizedBox(height: 24),
              _ProductFact(
                title: context.tr('Ingredients', 'పదార్థాలు'),
                body: product.ingredients.inLanguage(app.language),
              ),
              _ProductFact(
                title: context.tr('Extraction', 'వెలికితీత'),
                body: product.extraction.inLanguage(app.language),
              ),
              _ProductFact(
                title: context.tr('Storage', 'నిల్వ'),
                body: product.storage.inLanguage(app.language),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ProductFact extends StatelessWidget {
  const _ProductFact({required this.title, required this.body});
  final String title, body;
  @override
  Widget build(BuildContext context) => ExpansionTile(
    tilePadding: EdgeInsets.zero,
    title: Text(title, style: Theme.of(context).textTheme.titleMedium),
    childrenPadding: const EdgeInsets.only(bottom: 20),
    expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        body.isEmpty
            ? context.tr(
                'Details have not been provided by the store yet.',
                'స్టోర్ ఇంకా వివరాలను అందించలేదు.',
              )
            : body,
      ),
    ],
  );
}
