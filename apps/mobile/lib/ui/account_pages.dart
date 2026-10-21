import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../domain/failure.dart';
import 'auth_checkout.dart';
import 'private_device_setup.dart';
import 'widgets.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({
    super.key,
    required this.onSignIn,
    required this.onAddress,
    required this.onName,
    required this.onReplay,
    required this.onInfo,
  });
  final VoidCallback onSignIn, onAddress, onName, onReplay;
  final ValueChanged<InfoTopic> onInfo;
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    return PageBody(
      children: [
        PageTitle(context.tr('Your account', 'మీ ఖాతా')),
        GuideCard(
          page: 'account',
          title: context.tr(
            'Make the next order easier',
            'తదుపరి ఆర్డర్‌ను సులభం చేయండి',
          ),
          body: context.tr(
            'Save your name and delivery address. Change language here, replay these tips, or get help from the store.',
            'మీ పేరు, డెలివరీ చిరునామా సేవ్ చేయండి. భాష మార్చండి, సూచనలు మళ్లీ చూడండి లేదా స్టోర్ నుంచి సహాయం పొందండి.',
          ),
        ),
        Text(
          context.tr('Language', 'భాష'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 16),
        const LanguageChoice(),
        const SizedBox(height: 28),
        if (PrivateDeviceSetup.enabled) ...[
          const PrivateDeviceSetup(),
          const SizedBox(height: 28),
        ],
        if (!app.signedIn)
          EmptyState(
            icon: Icons.person_outline,
            title: context.tr(
              'Save your next order a few steps',
              'తదుపరి ఆర్డర్‌ను సులభం చేయండి',
            ),
            body: context.tr(
              'Sign in to keep your cart, address and order history with your email account.',
              'కార్ట్, చిరునామా, ఆర్డర్ చరిత్రను మీ ఈమెయిల్ ఖాతాలో ఉంచడానికి సైన్ ఇన్ చేయండి.',
            ),
            action: FilledButton(
              onPressed: onSignIn,
              child: Text(
                context.tr('Sign in with email', 'ఈమెయిల్‌తో సైన్ ఇన్ చేయండి'),
              ),
            ),
          ),
        if (app.accountLoading)
          LoadingState(
            label: context.tr(
              'Loading your account…',
              'మీ ఖాతా లోడ్ అవుతోంది…',
            ),
          ),
        if (app.accountError != null)
          FailurePanel(
            error: app.accountError!,
            onRetry: () => unawaited(app.retryAccount()),
          ),
        if (app.accountReady) ...[
          Text(
            app.profile.displayName.isEmpty
                ? context.tr('Add your name', 'మీ పేరు జోడించండి')
                : app.profile.displayName,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            app.user?.email ??
                context.tr('Email account required', 'ఈమెయిల్ ఖాతా అవసరం'),
          ),
          TextButton(
            onPressed: onName,
            child: Text(context.tr('Edit name', 'పేరు మార్చండి')),
          ),
          const Divider(),
          ListTile(
            contentPadding: EdgeInsets.zero,
            minVerticalPadding: 16,
            title: Text(
              context.tr(
                'Saved delivery address',
                'సేవ్ చేసిన డెలివరీ చిరునామా',
              ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                app.address?.summary ??
                    context.tr(
                      'Add an address for your next order.',
                      'మీ తదుపరి ఆర్డర్ కోసం చిరునామా జోడించండి.',
                    ),
              ),
            ),
            trailing: const Icon(Icons.edit_outlined),
            onTap: onAddress,
          ),
          const Divider(),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(context.tr('Page tips', 'పేజీ సూచనలు')),
            subtitle: Text(
              context.tr(
                'Optional guidance while you shop',
                'షాపింగ్ సమయంలో ఐచ్ఛిక మార్గదర్శకం',
              ),
            ),
            value: app.guide.welcomeSeen && !app.guide.skipped,
            onChanged: (value) => unawaited(
              perform(
                context,
                value
                    ? () => app.saveGuide(app.guide.welcome(skip: false))
                    : app.skipGuides,
              ),
            ),
          ),
          OutlinedButton.icon(
            onPressed: onReplay,
            icon: const Icon(Icons.replay),
            label: Text(
              context.tr(
                'Replay welcome & tips',
                'స్వాగతం, సూచనలు మళ్లీ చూడండి',
              ),
            ),
          ),
          const SizedBox(height: 28),
        ],
        for (final topic in [
          InfoTopic.story,
          InfoTopic.delivery,
          InfoTopic.policies,
          InfoTopic.help,
          InfoTopic.contact,
        ]) ...[
          ListTile(
            contentPadding: EdgeInsets.zero,
            minVerticalPadding: 16,
            title: Text(infoTitle(context, topic)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onInfo(topic),
          ),
          const Divider(),
        ],
        if (app.signedIn)
          OutlinedButton(
            onPressed: () => unawaited(perform(context, app.signOut)),
            child: Text(context.tr('Sign out', 'సైన్ అవుట్')),
          ),
        const SizedBox(height: 24),
        Text(
          AppConfig.internalBuild
              ? context.tr(
                  'Narayana Naturals · Internal test build · 1.0.0',
                  'నారాయణ నేచురల్స్ · అంతర్గత పరీక్ష వెర్షన్ · 1.0.0',
                )
              : 'Narayana Naturals · 1.0.0',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class NamePage extends StatefulWidget {
  const NamePage({super.key});
  @override
  State<NamePage> createState() => _NamePageState();
}

class _NamePageState extends State<NamePage> {
  final form = GlobalKey<FormState>(), name = TextEditingController();
  String? owner;
  bool busy = false;
  AppFailure? error;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (owner != context.app.user?.uid) {
      owner = context.app.user?.uid;
      name.text = context.app.profile.displayName;
    }
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    final app = context.app, uid = owner;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await app.saveName(name.text);
      if (mounted && app.user?.uid == uid) Navigator.of(context).pop();
    } catch (failure) {
      if (mounted) setState(() => error = AppFailure.from(failure));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(context.tr('Your name', 'మీ పేరు'))),
    body: SafeArea(
      child: PageBody(
        maxWidth: 560,
        children: [
          PageTitle(
            context.tr('What name should we use?', 'ఏ పేరు ఉపయోగించాలి?'),
          ),
          if (!context.app.signedIn)
            FailurePanel(error: const AppFailure('AUTH_REQUIRED'))
          else
            Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: name,
                    maxLength: 100,
                    textCapitalization: TextCapitalization.words,
                    autofillHints: const [AutofillHints.name],
                    decoration: InputDecoration(
                      labelText: context.tr('Full name', 'పూర్తి పేరు'),
                    ),
                    validator: (value) => (value?.trim().length ?? 0) >= 2
                        ? null
                        : context.tr(
                            'Enter at least two characters.',
                            'కనీసం రెండు అక్షరాలు నమోదు చేయండి.',
                          ),
                  ),
                  const SizedBox(height: 20),
                  if (error != null) FailurePanel(error: error!),
                  BusyButton(
                    label: context.tr('Save name', 'పేరు సేవ్ చేయండి'),
                    busy: busy,
                    onPressed: () => unawaited(save()),
                  ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }
}

enum InfoTopic { help, story, delivery, policies, contact }

String infoTitle(BuildContext context, InfoTopic topic) => switch (topic) {
  InfoTopic.story => context.tr('Our wooden Ghani story', 'మా చెక్క గానుగ కథ'),
  InfoTopic.delivery => context.tr(
    'Delivery & PIN codes',
    'డెలివరీ, పిన్ కోడ్‌లు',
  ),
  InfoTopic.policies => context.tr(
    'Product & customer information',
    'ఉత్పత్తి, కస్టమర్ సమాచారం',
  ),
  InfoTopic.contact => context.tr(
    'Contact & feedback',
    'సంప్రదింపు, అభిప్రాయం',
  ),
  InfoTopic.help => context.tr('Help with your order', 'మీ ఆర్డర్‌కు సహాయం'),
};

class InfoPage extends StatelessWidget {
  const InfoPage({super.key, required this.topic});
  final InfoTopic topic;
  @override
  Widget build(BuildContext context) {
    final app = context.app, product = context.app.catalogue?.product;
    final content = switch (topic) {
      InfoTopic.story => [
        const Center(child: BrandLogo(width: 90, mark: true)),
        const SizedBox(height: 28),
        Text(
          context.tr(
            'Groundnuts and a wooden Ghani',
            'వేరుశెనగలు, చెక్క గానుగ',
          ),
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        Text(
          product?.description.inLanguage(app.language) ??
              context.tr(
                'Narayana Naturals makes groundnut oil using a traditional bull-driven wooden Ghani.',
                'నారాయణ నేచురల్స్ సాంప్రదాయ ఎద్దుతో నడిచే చెక్క గానుగలో వేరుశెనగ నూనె తయారు చేస్తుంది.',
              ),
        ),
        const SizedBox(height: 28),
        Text(
          context.tr(
            'Read the ingredients and storage instructions for the pack you choose. Always check the delivered pack label.',
            'మీరు ఎంచుకున్న ప్యాక్ పదార్థాలు, నిల్వ సూచనలను చదవండి. అందుకున్న ప్యాక్ లేబుల్‌ను తనిఖీ చేయండి.',
          ),
        ),
      ],
      InfoTopic.delivery => [
        Text(
          context.tr(
            'Start with your exact PIN',
            'మీ సరైన పిన్‌తో ప్రారంభించండి',
          ),
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        Text(
          context.tr(
            'Enter your six-digit delivery PIN during checkout. The store checks whether delivery is available and returns the delivery charge and estimate.',
            'చెక్అవుట్‌లో మీ ఆరు అంకెల డెలివరీ పిన్ నమోదు చేయండి. స్టోర్ డెలివరీ లభ్యత, ఛార్జీ, అంచనాను తనిఖీ చేస్తుంది.',
          ),
        ),
        const SizedBox(height: 28),
        Text(
          context.tr(
            'Local delivery and courier shipping have different charges and cash-on-delivery availability. Review the complete total before confirming.',
            'స్థానిక డెలివరీ, కొరియర్‌కు వేర్వేరు ఛార్జీలు, నగదు చెల్లింపు లభ్యత ఉంటాయి. ధృవీకరణకు ముందు పూర్తి మొత్తం సమీక్షించండి.',
          ),
        ),
        if (app.preview) ...[
          const SizedBox(height: 28),
          Text(
            context.tr(
              'Preview delivery examples: 517001 and 517501 for local delivery; 560001 for courier. These are sample rules.',
              'ప్రివ్యూ డెలివరీ ఉదాహరణలు: స్థానిక డెలివరీకి 517001, 517501; కొరియర్‌కు 560001. ఇవి నమూనా నియమాలు.',
            ),
          ),
        ],
      ],
      InfoTopic.policies => [
        _InfoParagraph(
          title: context.tr('Product details', 'ఉత్పత్తి వివరాలు'),
          body: context.tr(
            'Check ingredients, storage, best-before date and other information on the delivered pack. Groundnut oil contains groundnut allergens.',
            'అందుకున్న ప్యాక్‌లో పదార్థాలు, నిల్వ, గడువు, ఇతర వివరాలను చూడండి. వేరుశెనగ నూనెలో వేరుశెనగ అలెర్జీ కారకాలు ఉంటాయి.',
          ),
        ),
        _InfoParagraph(
          title: context.tr('Payment', 'చెల్లింపు'),
          body: context.tr(
            'Cash on delivery is the available checkout method for eligible PIN codes. The app shows the full amount before order confirmation.',
            'అర్హత ఉన్న పిన్‌లకు డెలివరీ సమయంలో నగదు చెల్లింపు అందుబాటులో ఉంది. ఆర్డర్ ధృవీకరణకు ముందు యాప్ పూర్తి మొత్తాన్ని చూపుతుంది.',
          ),
        ),
        _InfoParagraph(
          title: context.tr(
            'Returns, replacements and food-business details',
            'రిటర్న్‌లు, మార్పిడి, ఆహార వ్యాపార వివరాలు',
          ),
          body: context.tr(
            'The store has not supplied final returns, replacement or food-business policy details in this build. Contact the store with your order ID for help.',
            'ఈ వెర్షన్‌లో స్టోర్ తుది రిటర్న్‌లు, మార్పిడి, ఆహార వ్యాపార పాలసీ వివరాలను అందించలేదు. సహాయం కోసం ఆర్డర్ ఐడితో స్టోర్‌ను సంప్రదించండి.',
          ),
        ),
        _InfoParagraph(
          title: context.tr('Your account information', 'మీ ఖాతా సమాచారం'),
          body: context.tr(
            'Your email and password sign you into your account. Your signed-in account saves your cart, name, delivery address, orders and guide preferences. Sign out when using a shared device.',
            'మీ ఈమెయిల్ మరియు పాస్‌వర్డ్‌తో ఖాతాలోకి సైన్ ఇన్ చేయండి. ఖాతాలో కార్ట్, పేరు, చిరునామా, ఆర్డర్‌లు, సూచనల ఎంపికలు సేవ్ అవుతాయి. ఇతరులు ఉపయోగించే పరికరంలో సైన్ అవుట్ చేయండి.',
          ),
        ),
      ],
      InfoTopic.help => [
        _InfoParagraph(
          title: context.tr('Forgot your password?', 'పాస్‌వర్డ్ మర్చిపోయారా?'),
          body: context.tr(
            'Choose Forgot password on the sign-in screen and enter your account email. Check your inbox and spam folder for the reset link. Local previews do not send email.',
            'సైన్ ఇన్ పేజీలో పాస్‌వర్డ్ మర్చిపోయారా ఎంచుకుని మీ ఖాతా ఈమెయిల్ నమోదు చేయండి. రీసెట్ లింక్ కోసం ఇన్‌బాక్స్ మరియు స్పామ్ ఫోల్డర్ చూడండి. స్థానిక ప్రివ్యూలో ఈమెయిల్ పంపబడదు.',
          ),
        ),
        _InfoParagraph(
          title: context.tr(
            'Order response was interrupted?',
            'ఆర్డర్ స్పందన ఆగిపోయిందా?',
          ),
          body: context.tr(
            'Open Cart and review the original order. Retry checks the same order request, so a slow connection cannot place it twice.',
            'కార్ట్ తెరిచి మొదటి ఆర్డర్‌ను సమీక్షించండి. మళ్లీ ప్రయత్నిస్తే అదే అభ్యర్థన తనిఖీ అవుతుంది; కనెక్షన్ ఆలస్యంతో రెండుసార్లు ఆర్డర్ రాదు.',
          ),
        ),
        _InfoParagraph(
          title: context.tr(
            'Price or stock changed?',
            'ధర లేదా స్టాక్ మారిందా?',
          ),
          body: context.tr(
            'Update the pack quantity and review a new delivery total. A saved quote does not reserve stock.',
            'ప్యాక్ సంఖ్య మార్చి కొత్త డెలివరీ మొత్తం సమీక్షించండి. సేవ్ చేసిన కోట్ స్టాక్‌ను రిజర్వ్ చేయదు.',
          ),
        ),
        _InfoParagraph(
          title: context.tr('Want to order again?', 'మళ్లీ ఆర్డర్ చేయాలా?'),
          body: context.tr(
            'Open an order and choose Reorder available packs. Check your new cart and delivery total before confirming.',
            'ఆర్డర్ తెరిచి అందుబాటులో ఉన్న ప్యాక్‌లను మళ్లీ కొనండి. ధృవీకరణకు ముందు కొత్త కార్ట్, డెలివరీ మొత్తం తనిఖీ చేయండి.',
          ),
        ),
      ],
      InfoTopic.contact => [
        Text(
          context.tr(
            'Talk to Narayana Naturals',
            'నారాయణ నేచురల్స్‌ను సంప్రదించండి',
          ),
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        Text(
          context.tr(
            'For an order question or feedback, include your order ID when contacting the store.',
            'ఆర్డర్ ప్రశ్న లేదా అభిప్రాయం కోసం స్టోర్‌ను సంప్రదించేటప్పుడు మీ ఆర్డర్ ఐడిని చెప్పండి.',
          ),
        ),
      ],
    };
    return Scaffold(
      appBar: AppBar(title: Text(infoTitle(context, topic))),
      body: SafeArea(
        child: PageBody(
          maxWidth: 650,
          children: [
            ...content,
            const SizedBox(height: 28),
            const ContactActions(),
          ],
        ),
      ),
    );
  }
}

class _InfoParagraph extends StatelessWidget {
  const _InfoParagraph({required this.title, required this.body});
  final String title, body;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Text(body),
      ],
    ),
  );
}

class ContactActions extends StatelessWidget {
  const ContactActions({super.key});
  @override
  Widget build(BuildContext context) {
    final supplied = context.app.catalogue?.settings.supportPhone ?? '';
    var digits = supplied.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length == 10) digits = '91$digits';
    if (!RegExp(r'^91[6-9][0-9]{9}$').hasMatch(digits)) {
      return Text(
        context.tr(
          'The store has not published its support number yet. Please check back for contact details.',
          'స్టోర్ ఇంకా సహాయ ఫోన్ నంబర్‌ను ప్రచురించలేదు. సంప్రదింపు వివరాల కోసం తర్వాత చూడండి.',
        ),
      );
    }
    final number = digits;
    Future<void> open(Uri uri) async {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) throw const AppFailure('CONTACT_UNAVAILABLE');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SelectableText(
          '+$number',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => unawaited(
            perform(context, () => open(Uri(scheme: 'tel', path: '+$number'))),
          ),
          icon: const Icon(Icons.phone_outlined),
          label: Text(context.tr('Call the store', 'స్టోర్‌కు కాల్ చేయండి')),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => unawaited(
            perform(context, () => open(Uri.https('wa.me', '/$number'))),
          ),
          icon: const Icon(Icons.chat_bubble_outline),
          label: Text(context.tr('Open WhatsApp', 'వాట్సాప్ తెరవండి')),
        ),
      ],
    );
  }
}
