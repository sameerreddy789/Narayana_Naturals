import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../app_controller.dart';
import '../config.dart';
import '../domain/failure.dart';

class AppScope extends InheritedNotifier<AppController> {
  const AppScope({
    super.key,
    required AppController controller,
    required super.child,
  }) : super(notifier: controller);
  static AppController of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

extension CustomerContext on BuildContext {
  AppController get app => AppScope.of(this);
  String tr(String en, String te) => app.tr(en, te);
}

Future<void> perform(
  BuildContext context,
  Future<void> Function() action, {
  String? success,
}) async {
  final controller = context.app;
  try {
    await action();
    if (context.mounted && success != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(success)));
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppFailure.from(error).message(controller.language)),
        ),
      );
    }
  }
}

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.width = 180, this.mark = false});
  final double width;
  final bool mark;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Narayana Naturals',
    image: true,
    child: SvgPicture.asset(
      mark ? 'assets/brand/mark.svg' : 'assets/brand/horizontal.svg',
      width: width,
      fit: BoxFit.contain,
      excludeFromSemantics: true,
      colorFilter: Theme.of(context).brightness == Brightness.dark && !mark
          ? ColorFilter.mode(
              Theme.of(context).colorScheme.onSurface,
              BlendMode.srcIn,
            )
          : null,
    ),
  );
}

class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.children, this.maxWidth = 740});
  final List<Widget> children;
  final double maxWidth;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
    child: Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ),
      ),
    ),
  );
}

class PageTitle extends StatelessWidget {
  const PageTitle(this.title, {super.key, this.description});
  final String title;
  final String? description;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineMedium),
        if (description != null) ...[
          const SizedBox(height: 12),
          Text(description!),
        ],
      ],
    ),
  );
}

class ModeBanner extends StatelessWidget {
  const ModeBanner({super.key});
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    if (!app.preview) return const SizedBox.shrink();
    final emulator = app.backend.mode == BackendMode.emulator;
    return ColoredBox(
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Semantics(
          liveRegion: true,
          child: Text(
            emulator
                ? context.tr(
                    'Emulator preview · No real order, SMS or payment',
                    'ఎమ్యులేటర్ ప్రివ్యూ · నిజమైన ఆర్డర్, ఎస్‌ఎమ్‌ఎస్ లేదా చెల్లింపు లేదు',
                  )
                : context.tr(
                    'Preview · Sample prices. No real order or payment',
                    'ప్రివ్యూ · నమూనా ధరలు. నిజమైన ఆర్డర్ లేదా చెల్లింపు లేదు',
                  ),
            style: Theme.of(context).textTheme.bodySmall!.copyWith(
              color: Theme.of(context).colorScheme.onSecondaryContainer,
            ),
          ),
        ),
      ),
    );
  }
}

class PackArtwork extends StatelessWidget {
  const PackArtwork({super.key, this.litres = 1, this.compact = false});
  final int litres;
  final bool compact;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      image: true,
      label: context.tr(
        '$litres litre pack illustration',
        '$litres లీటర్ ప్యాక్ చిత్రం',
      ),
      child: ExcludeSemantics(
        child: Container(
          decoration: BoxDecoration(
            color: scheme.surfaceContainerLow,
            borderRadius: BorderRadius.circular(16),
          ),
          padding: EdgeInsets.all(compact ? 14 : 26),
          child: AspectRatio(
            aspectRatio: compact ? 0.9 : 1.3,
            child: FittedBox(
              fit: BoxFit.contain,
              child: SizedBox(
                width: 190,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 60,
                      height: 17,
                      decoration: BoxDecoration(
                        color: const Color(0xff183a28),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    Container(
                      width: 44,
                      height: 13,
                      color: const Color(0xffd9a52c),
                    ),
                    Container(
                      width: 145,
                      height: 178,
                      decoration: BoxDecoration(
                        color: const Color(0xffd9a52c),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      alignment: Alignment.center,
                      child: Container(
                        width: 124,
                        height: 142,
                        color: const Color(0xfffdfcf7),
                        padding: const EdgeInsets.all(12),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: SizedBox(
                            width: 100,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const BrandLogo(width: 44, mark: true),
                                const SizedBox(height: 6),
                                const Text(
                                  'Narayana Naturals',
                                  style: TextStyle(
                                    fontFamily: 'SourceSans3',
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xff183a28),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '$litres L',
                                  style: const TextStyle(
                                    fontFamily: 'Anek',
                                    fontSize: 32,
                                    height: 1.2,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xff183a28),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      context.tr('Pack illustration', 'ప్యాక్ చిత్రం'),
                      style: TextStyle(
                        fontFamily: context.app.language == 'te'
                            ? 'NotoTelugu'
                            : 'SourceSans3',
                        fontSize: 12,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class FailurePanel extends StatelessWidget {
  const FailurePanel({
    super.key,
    required this.error,
    this.onRetry,
    this.title,
  });
  final AppFailure error;
  final VoidCallback? onRetry;
  final String? title;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 20),
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Semantics(
      liveRegion: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(title!, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
          ],
          Text(
            error.message(context.app.language),
            style: TextStyle(
              color: Theme.of(context).colorScheme.onErrorContainer,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: Text(context.tr('Try again', 'మళ్లీ ప్రయత్నించండి')),
            ),
          ],
        ],
      ),
    ),
  );
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 48),
    child: Semantics(
      liveRegion: true,
      child: Column(
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 20),
          Text(label, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 20),
        Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(body, textAlign: TextAlign.center),
        if (action != null) ...[const SizedBox(height: 24), action!],
      ],
    ),
  );
}

class GuideCard extends StatelessWidget {
  const GuideCard({
    super.key,
    required this.page,
    required this.title,
    required this.body,
  });
  final String page;
  final String title;
  final String body;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    if (!app.accountReady || !app.guide.shouldShow(page)) {
      return const SizedBox.shrink();
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: context.tr('Dismiss this tip', 'ఈ సూచనను మూసివేయండి'),
                onPressed: () =>
                    unawaited(perform(context, () => app.dismissGuide(page))),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Padding(padding: const EdgeInsets.only(right: 8), child: Text(body)),
          TextButton(
            onPressed: () => unawaited(perform(context, app.skipGuides)),
            child: Text(context.tr('Skip all tips', 'అన్ని సూచనలను దాటవేయండి')),
          ),
        ],
      ),
    );
  }
}

class BusyButton extends StatelessWidget {
  const BusyButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.icon,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: busy ? null : onPressed,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        else if (icon != null)
          Icon(icon, size: 20),
        if (busy || icon != null) const SizedBox(width: 10),
        Flexible(child: Text(label, textAlign: TextAlign.center)),
      ],
    ),
  );
}

class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.id,
    required this.quantity,
    required this.maximum,
    this.enabled = true,
  });
  final String id;
  final int quantity;
  final int maximum;
  final bool enabled;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      IconButton.filledTonal(
        key: ValueKey('decrease_$id'),
        tooltip: context.tr('Remove one pack', 'ఒక ప్యాక్ తగ్గించండి'),
        onPressed: enabled && quantity > 0
            ? () => unawaited(
                perform(
                  context,
                  () => context.app.setQuantity(id, quantity - 1),
                ),
              )
            : null,
        icon: const Icon(Icons.remove),
      ),
      const SizedBox(width: 8),
      Semantics(
        label: context.tr('$quantity packs', '$quantity ప్యాక్‌లు'),
        child: SizedBox(
          width: 40,
          child: Text(
            '$quantity',
            style: Theme.of(context).textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
        ),
      ),
      const SizedBox(width: 8),
      IconButton.filledTonal(
        key: ValueKey('increase_$id'),
        tooltip: context.tr('Add one pack', 'ఒక ప్యాక్ జోడించండి'),
        onPressed: enabled && quantity < maximum
            ? () => unawaited(
                perform(
                  context,
                  () => context.app.setQuantity(id, quantity + 1),
                ),
              )
            : null,
        icon: const Icon(Icons.add),
      ),
    ],
  );
}

class TotalRow extends StatelessWidget {
  const TotalRow(this.label, this.value, {super.key, this.strong = false});
  final String label;
  final String value;
  final bool strong;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: strong ? Theme.of(context).textTheme.titleMedium : null,
          ),
        ),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: strong
                ? Theme.of(context).textTheme.titleLarge
                : Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ],
    ),
  );
}

class CatalogueStatus extends StatelessWidget {
  const CatalogueStatus({super.key});
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    if (app.catalogueLoading) {
      return LoadingState(
        label: context.tr(
          'Loading packs and prices…',
          'ప్యాక్‌లు, ధరలు లోడ్ అవుతున్నాయి…',
        ),
      );
    }
    if (app.catalogueError != null) {
      return FailurePanel(
        error: app.catalogueError!,
        title: context.tr(
          'Catalogue could not load',
          'ఉత్పత్తుల వివరాలు లోడ్ కాలేదు',
        ),
        onRetry: () => unawaited(app.reloadCatalogue()),
      );
    }
    if (app.catalogue?.published != true) {
      return EmptyState(
        icon: Icons.eco_outlined,
        title: context.tr(
          'Packs will appear here',
          'ప్యాక్‌లు ఇక్కడ కనిపిస్తాయి',
        ),
        body: context.tr(
          'The store has not published its catalogue yet. Please check back soon.',
          'స్టోర్ ఇంకా ఉత్పత్తుల వివరాలను ప్రచురించలేదు. తర్వాత మళ్లీ చూడండి.',
        ),
        action: OutlinedButton(
          onPressed: () => unawaited(app.reloadCatalogue()),
          child: Text(context.tr('Refresh', 'రిఫ్రెష్')),
        ),
      );
    }
    final notice = app.catalogue!.settings.notice.inLanguage(app.language);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (app.catalogue!.fromCache)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              context.tr(
                'Saved catalogue · Reconnect to check current availability.',
                'సేవ్ చేసిన వివరాలు · తాజా లభ్యత కోసం కనెక్ట్ అవ్వండి.',
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        if (notice.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Text(notice),
          ),
        if (!app.catalogue!.settings.orderingEnabled)
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Text(
              context.tr(
                'Ordering is paused. You can still browse the packs.',
                'ఆర్డర్లు తాత్కాలికంగా ఆగాయి. మీరు ప్యాక్‌లను చూడవచ్చు.',
              ),
            ),
          ),
      ],
    );
  }
}
