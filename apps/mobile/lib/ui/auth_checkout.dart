import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_controller.dart';
import '../config.dart';
import '../domain/failure.dart';
import '../domain/models.dart';
import 'widgets.dart';

class LanguageChoice extends StatelessWidget {
  const LanguageChoice({super.key});
  @override
  Widget build(BuildContext context) => SegmentedButton<String>(
    showSelectedIcon: false,
    segments: const [
      ButtonSegment(value: 'en', label: Text('English')),
      ButtonSegment(value: 'te', label: Text('తెలుగు')),
    ],
    selected: {context.app.language},
    onSelectionChanged: (values) => unawaited(
      perform(context, () => context.app.setLanguage(values.first)),
    ),
  );
}

class SignInPage extends StatefulWidget {
  const SignInPage({super.key});
  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  final email = TextEditingController();
  final password = TextEditingController();
  final name = TextEditingController();
  final form = GlobalKey<FormState>();
  AppController? controller;
  AppFailure? error;
  bool busy = false, createAccount = false, reset = false, showPassword = false;
  bool completing = false, loginFinished = false, resetSent = false;
  String? requestedEmail;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (controller == null) {
      controller = context.app;
      controller!.addListener(authChanged);
    }
  }

  void authChanged() {
    if (!mounted ||
        completing ||
        !loginFinished ||
        controller?.accountReady != true ||
        controller?.user?.email != requestedEmail) {
      return;
    }
    completing = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).pop(true);
    });
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) return;
    requestedEmail = email.text.trim().toLowerCase();
    setState(() {
      busy = true;
      error = null;
      resetSent = false;
    });
    try {
      final app = controller!;
      if (reset) {
        await app.backend.resetPassword(requestedEmail!);
        if (mounted) setState(() => resetSent = true);
      } else {
        await app.backend.signInEmail(
          requestedEmail!,
          password.text,
          name: createAccount ? name.text.trim() : null,
          createAccount: createAccount,
          language: app.language,
        );
        loginFinished = true;
        TextInput.finishAutofillContext(shouldSave: true);
        authChanged();
      }
    } catch (failure) {
      if (mounted) setState(() => error = AppFailure.from(failure));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void selectMode({bool creating = false, bool resetting = false}) {
    setState(() {
      createAccount = creating;
      reset = resetting;
      error = null;
      resetSent = false;
      loginFinished = false;
    });
    form.currentState?.reset();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final demo = app.backend.mode == BackendMode.demo;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          context.tr(
            reset
                ? 'Reset password'
                : createAccount
                ? 'Create account'
                : 'Sign in',
            reset
                ? 'పాస్‌వర్డ్ మార్చండి'
                : createAccount
                ? 'ఖాతా సృష్టించండి'
                : 'సైన్ ఇన్',
          ),
        ),
      ),
      body: SafeArea(
        child: PageBody(
          maxWidth: 560,
          children: [
            const ModeBanner(),
            const SizedBox(height: 24),
            PageTitle(
              context.tr(
                reset
                    ? 'Get back to your account'
                    : 'Your email. Your cart and orders.',
                reset
                    ? 'మీ ఖాతాలోకి తిరిగి రండి'
                    : 'మీ ఈమెయిల్. మీ కార్ట్, ఆర్డర్‌లు.',
              ),
              description: context.tr(
                reset
                    ? 'We’ll email you a link to choose a new password.'
                    : demo
                    ? 'Sign in to an account on this device. Preview orders stay on this device.'
                    : app.privateDraft
                    ? 'Use your approved email account. Your cart and address sync with the website; orders are disabled in this private demo.'
                    : 'Use the same email on the website and app to keep your cart and orders together.',
                reset
                    ? 'కొత్త పాస్‌వర్డ్ ఎంచుకోవడానికి మీకు ఈమెయిల్ లింక్ పంపుతాము.'
                    : demo
                    ? 'ఈ పరికరంలో ఖాతాతో సైన్ ఇన్ చేయండి. ప్రివ్యూ ఆర్డర్‌లు ఈ పరికరంలోనే ఉంటాయి.'
                    : app.privateDraft
                    ? 'అనుమతి పొందిన మీ ఈమెయిల్ ఖాతా ఉపయోగించండి. కార్ట్, చిరునామా వెబ్‌సైట్‌తో సేవ్ అవుతాయి; ఈ ప్రైవేట్ డెమోలో ఆర్డర్లు నిలిపివేయబడ్డాయి.'
                    : 'వెబ్‌సైట్, యాప్‌లో అదే ఈమెయిల్‌తో మీ కార్ట్, ఆర్డర్‌లను ఒకే చోట ఉంచండి.',
              ),
            ),
            const LanguageChoice(),
            const SizedBox(height: 24),
            if (!reset)
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  ChoiceChip(
                    key: const ValueKey('auth_sign_in'),
                    label: Text(context.tr('Sign in', 'సైన్ ఇన్')),
                    selected: !createAccount,
                    onSelected: busy ? null : (_) => selectMode(),
                  ),
                  ChoiceChip(
                    key: const ValueKey('auth_create'),
                    label: Text(
                      context.tr('Create account', 'ఖాతా సృష్టించండి'),
                    ),
                    selected: createAccount,
                    onSelected: busy ? null : (_) => selectMode(creating: true),
                  ),
                ],
              ),
            const SizedBox(height: 24),
            AutofillGroup(
              child: Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (createAccount && !reset) ...[
                      TextFormField(
                        key: const ValueKey('sign_in_name'),
                        controller: name,
                        enabled: !busy,
                        autofillHints: const [AutofillHints.name],
                        textInputAction: TextInputAction.next,
                        maxLength: 100,
                        decoration: InputDecoration(
                          labelText: context.tr('Your name', 'మీ పేరు'),
                          counterText: '',
                        ),
                        validator: (value) => (value?.trim().length ?? 0) >= 2
                            ? null
                            : context.tr(
                                'Enter your name.',
                                'మీ పేరు నమోదు చేయండి.',
                              ),
                      ),
                      const SizedBox(height: 20),
                    ],
                    TextFormField(
                      key: const ValueKey('sign_in_email'),
                      controller: email,
                      enabled: !busy,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [
                        AutofillHints.username,
                        AutofillHints.email,
                      ],
                      autocorrect: false,
                      enableSuggestions: false,
                      maxLength: 254,
                      textInputAction: reset
                          ? TextInputAction.done
                          : TextInputAction.next,
                      onFieldSubmitted: reset
                          ? (_) => unawaited(submit())
                          : null,
                      decoration: InputDecoration(
                        labelText: context.tr(
                          'Email address',
                          'ఈమెయిల్ చిరునామా',
                        ),
                        counterText: '',
                      ),
                      validator: (value) =>
                          RegExp(
                            r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                          ).hasMatch(value?.trim() ?? '')
                          ? null
                          : context.tr(
                              'Enter a valid email address.',
                              'చెల్లుబాటు అయ్యే ఈమెయిల్ చిరునామా నమోదు చేయండి.',
                            ),
                    ),
                    if (!reset) ...[
                      const SizedBox(height: 20),
                      TextFormField(
                        key: const ValueKey('sign_in_password'),
                        controller: password,
                        enabled: !busy,
                        obscureText: !showPassword,
                        autocorrect: false,
                        enableSuggestions: false,
                        autofillHints: [
                          createAccount
                              ? AutofillHints.newPassword
                              : AutofillHints.password,
                        ],
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => unawaited(submit()),
                        maxLength: 128,
                        decoration: InputDecoration(
                          labelText: context.tr('Password', 'పాస్‌వర్డ్'),
                          helperText: createAccount
                              ? context.tr(
                                  'At least 8 characters',
                                  'కనీసం 8 అక్షరాలు',
                                )
                              : null,
                          counterText: '',
                          suffixIcon: IconButton(
                            tooltip: context.tr(
                              showPassword ? 'Hide password' : 'Show password',
                              showPassword
                                  ? 'పాస్‌వర్డ్ దాచండి'
                                  : 'పాస్‌వర్డ్ చూపండి',
                            ),
                            onPressed: () =>
                                setState(() => showPassword = !showPassword),
                            icon: Icon(
                              showPassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                          ),
                        ),
                        validator: (value) => value == null || value.isEmpty
                            ? context.tr(
                                'Enter your password.',
                                'మీ పాస్‌వర్డ్ నమోదు చేయండి.',
                              )
                            : createAccount && value.length < 8
                            ? context.tr(
                                'Use at least 8 characters.',
                                'కనీసం 8 అక్షరాలు ఉపయోగించండి.',
                              )
                            : null,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (!reset && !createAccount)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  key: const ValueKey('auth_forgot'),
                  onPressed: busy ? null : () => selectMode(resetting: true),
                  child: Text(
                    context.tr('Forgot password?', 'పాస్‌వర్డ్ మర్చిపోయారా?'),
                  ),
                ),
              ),
            if (resetSent)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  context.tr(
                    demo
                        ? 'Preview only: no email was sent. Return to sign in to try your account.'
                        : app.backend.mode == BackendMode.emulator
                        ? 'Reset link created in the local Auth emulator. No real email was sent.'
                        : 'If this email has an account, a reset link is on its way. Check your inbox and spam folder.',
                    demo
                        ? 'ప్రివ్యూ మాత్రమే: ఈమెయిల్ పంపబడలేదు. ఖాతా ప్రయత్నించడానికి సైన్ ఇన్‌కు తిరిగి రండి.'
                        : app.backend.mode == BackendMode.emulator
                        ? 'స్థానిక ఆత్ ఎమ్యులేటర్‌లో రీసెట్ లింక్ సృష్టించబడింది. నిజమైన ఈమెయిల్ పంపబడలేదు.'
                        : 'ఈ ఈమెయిల్‌తో ఖాతా ఉంటే రీసెట్ లింక్ వస్తుంది. ఇన్‌బాక్స్, స్పామ్ చూడండి.',
                  ),
                ),
              ),
            if (error != null) FailurePanel(error: error!),
            if (app.accountError != null && !reset)
              FailurePanel(
                error: app.accountError!,
                title: context.tr(
                  'Signed in. Your account could not load.',
                  'సైన్ ఇన్ అయింది. మీ ఖాతా లోడ్ కాలేదు.',
                ),
                onRetry: () => unawaited(app.retryAccount()),
              ),
            if (app.accountLoading && !reset)
              LoadingState(
                label: context.tr(
                  'Loading your saved cart and orders…',
                  'మీ సేవ్ చేసిన కార్ట్, ఆర్డర్‌లు లోడ్ అవుతున్నాయి…',
                ),
              ),
            BusyButton(
              key: const ValueKey('sign_in_continue'),
              busy: busy || (!reset && app.accountLoading),
              label: context.tr(
                reset
                    ? 'Send reset link'
                    : createAccount
                    ? 'Create account & continue'
                    : 'Sign in & continue',
                reset
                    ? 'రీసెట్ లింక్ పంపండి'
                    : createAccount
                    ? 'ఖాతా సృష్టించి కొనసాగించండి'
                    : 'సైన్ ఇన్ చేసి కొనసాగించండి',
              ),
              onPressed: () => unawaited(submit()),
            ),
            if (reset)
              TextButton(
                onPressed: busy ? null : () => selectMode(),
                child: Text(
                  context.tr('Back to sign in', 'సైన్ ఇన్‌కు తిరిగి రండి'),
                ),
              ),
            const SizedBox(height: 20),
            Text(
              context.tr(
                'Your email signs you in. We ask for a mobile number with your delivery address.',
                'మీ ఈమెయిల్‌తో సైన్ ఇన్ అవ్వండి. డెలివరీ చిరునామాతో మొబైల్ నంబర్ అడుగుతాము.',
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    controller?.removeListener(authChanged);
    email.dispose();
    password.dispose();
    name.dispose();
    super.dispose();
  }
}

class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});
  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  bool busy = false;
  AppFailure? error;
  Future<void> choose(bool skip) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await context.app.welcome(skip: skip);
      if (mounted) Navigator.of(context).pop();
    } catch (failure) {
      if (mounted) setState(() => error = AppFailure.from(failure));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(context.tr('Welcome', 'స్వాగతం'))),
    body: SafeArea(
      child: PageBody(
        maxWidth: 560,
        children: [
          const Center(child: BrandLogo(width: 90, mark: true)),
          const SizedBox(height: 28),
          PageTitle(
            context.tr(
              'Welcome to Narayana Naturals',
              'నారాయణ నేచురల్స్‌కు స్వాగతం',
            ),
            description: context.tr(
              'Your email account keeps your cart, address and orders together across the website and app.',
              'మీ ఈమెయిల్ ఖాతా వెబ్‌సైట్, యాప్‌లో కార్ట్, చిరునామా, ఆర్డర్‌లను ఒకే చోట ఉంచుతుంది.',
            ),
          ),
          const LanguageChoice(),
          const SizedBox(height: 28),
          Text(
            context.tr('Choose a pack in Shop.', 'షాప్‌లో ప్యాక్ ఎంచుకోండి.'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 16),
          Text(
            context.tr(
              'Check delivery with your six-digit PIN.',
              'ఆరు అంకెల పిన్‌తో డెలివరీ తనిఖీ చేయండి.',
            ),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 16),
          Text(
            context.tr(
              'Review the total and pay cash on delivery.',
              'మొత్తం సమీక్షించి డెలివరీ సమయంలో నగదు చెల్లించండి.',
            ),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 28),
          Text(
            context.tr(
              'Optional tips explain each page. Dismiss them one at a time, skip them all, or replay from Account.',
              'ఐచ్ఛిక సూచనలు ప్రతి పేజీని వివరిస్తాయి. ఒక్కొక్కటి మూసివేయండి, అన్నీ దాటవేయండి లేదా ఖాతా నుంచి మళ్లీ చూడండి.',
            ),
          ),
          const SizedBox(height: 24),
          if (error != null) FailurePanel(error: error!),
          BusyButton(
            key: const ValueKey('welcome_show_tips'),
            label: context.tr('Show page tips', 'పేజీ సూచనలు చూపండి'),
            busy: busy,
            onPressed: () => unawaited(choose(false)),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            key: const ValueKey('welcome_skip'),
            onPressed: busy ? null : () => unawaited(choose(true)),
            child: Text(context.tr('Skip tips', 'సూచనలు దాటవేయండి')),
          ),
        ],
      ),
    ),
  );
}

class AddressPage extends StatefulWidget {
  const AddressPage({
    super.key,
    required this.onQuoted,
    this.checkout = true,
    this.onSaved,
  });
  final ValueChanged<PendingCheckout> onQuoted;
  final bool checkout;
  final VoidCallback? onSaved;
  @override
  State<AddressPage> createState() => _AddressPageState();
}

class _AddressPageState extends State<AddressPage> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController(),
      phone = TextEditingController(),
      street = TextEditingController(),
      city = TextEditingController(),
      pin = TextEditingController();
  String? owner;
  bool initialized = false, busy = false;
  AppFailure? error;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = context.app;
    if (!initialized || owner != app.user?.uid) {
      initialized = true;
      owner = app.user?.uid;
      final address = app.address;
      name.text = address?.name ?? app.profile.displayName;
      phone.text = address?.phone ?? '';
      street.text = address?.street ?? '';
      city.text = address?.city ?? '';
      pin.text = address?.pin ?? '';
    }
  }

  Future<void> review() async {
    if (!form.currentState!.validate()) return;
    final app = context.app, uid = owner;
    final address = DeliveryAddress(
      name: name.text.trim(),
      phone: phone.text.trim(),
      street: street.text.trim(),
      city: city.text.trim(),
      pin: pin.text.trim(),
    );
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await app.saveAddress(address);
      if (!mounted || app.user?.uid != uid) {
        throw const AppFailure('AUTH_REQUIRED');
      }
      if (widget.checkout) {
        final quote = await app.reviewCheckout(address);
        if (mounted && app.user?.uid == uid) widget.onQuoted(quote);
      } else if (mounted) {
        widget.onSaved?.call();
      }
    } catch (failure) {
      if (mounted) setState(() => error = AppFailure.from(failure));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    String? lengthValidation(String? value, int minimum, String message) =>
        (value?.trim().length ?? 0) < minimum ? message : null;
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('Delivery address', 'డెలివరీ చిరునామా')),
      ),
      body: SafeArea(
        child: PageBody(
          maxWidth: 560,
          children: [
            const ModeBanner(),
            const SizedBox(height: 20),
            PageTitle(
              context.tr('Where should we deliver?', 'ఎక్కడ డెలివరీ చేయాలి?'),
              description: context.tr(
                'Your PIN determines delivery availability, charges and cash on delivery.',
                'మీ పిన్ డెలివరీ లభ్యత, ఛార్జీలు, నగదు చెల్లింపును నిర్ణయిస్తుంది.',
              ),
            ),
            if (widget.checkout)
              GuideCard(
                page: 'checkout',
                title: context.tr(
                  'Check the full total first',
                  'ముందు పూర్తి మొత్తం తనిఖీ చేయండి',
                ),
                body: context.tr(
                  'Enter an exact six-digit PIN. The next page shows a fresh total from the store before you confirm an order.',
                  'సరైన ఆరు అంకెల పిన్ నమోదు చేయండి. ఆర్డర్ ధృవీకరణకు ముందు తదుపరి పేజీలో స్టోర్ నుంచి తాజా మొత్తం కనిపిస్తుంది.',
                ),
              ),
            if (app.accountLoading)
              LoadingState(
                label: context.tr(
                  'Loading your address…',
                  'మీ చిరునామా లోడ్ అవుతోంది…',
                ),
              ),
            if (app.accountError != null)
              FailurePanel(
                error: app.accountError!,
                onRetry: () => unawaited(app.retryAccount()),
              ),
            if (!app.signedIn)
              FailurePanel(error: const AppFailure('AUTH_REQUIRED')),
            if (app.accountReady)
              Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const ValueKey('address_name'),
                      controller: name,
                      maxLength: 100,
                      autofillHints: const [AutofillHints.name],
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: context.tr('Full name', 'పూర్తి పేరు'),
                        counterText: '',
                      ),
                      validator: (value) => lengthValidation(
                        value,
                        2,
                        context.tr(
                          'Enter at least two characters.',
                          'కనీసం రెండు అక్షరాలు నమోదు చేయండి.',
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      key: const ValueKey('address_phone'),
                      controller: phone,
                      maxLength: 10,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: context.tr(
                          'Delivery mobile number',
                          'డెలివరీ మొబైల్ నంబర్',
                        ),
                        prefixText: '+91 ',
                        counterText: '',
                      ),
                      validator: (value) =>
                          RegExp(r'^[6-9][0-9]{9}$').hasMatch(value ?? '')
                          ? null
                          : context.tr(
                              'Enter a valid 10-digit mobile number.',
                              'సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.',
                            ),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      key: const ValueKey('address_street'),
                      controller: street,
                      maxLength: 300,
                      minLines: 2,
                      maxLines: 4,
                      autofillHints: const [AutofillHints.streetAddressLine1],
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        labelText: context.tr(
                          'House, street and area',
                          'ఇల్లు, వీధి, ప్రాంతం',
                        ),
                        counterText: '',
                      ),
                      validator: (value) => lengthValidation(
                        value,
                        5,
                        context.tr(
                          'Enter a complete street address.',
                          'పూర్తి వీధి చిరునామా నమోదు చేయండి.',
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      key: const ValueKey('address_city'),
                      controller: city,
                      maxLength: 100,
                      autofillHints: const [AutofillHints.addressCity],
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: context.tr('City / town', 'నగరం / పట్టణం'),
                        counterText: '',
                      ),
                      validator: (value) => lengthValidation(
                        value,
                        2,
                        context.tr(
                          'Enter your city or town.',
                          'మీ నగరం లేదా పట్టణం నమోదు చేయండి.',
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      key: const ValueKey('address_pin'),
                      controller: pin,
                      maxLength: 6,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.postalCode],
                      decoration: InputDecoration(
                        labelText: context.tr(
                          'Delivery PIN code',
                          'డెలివరీ పిన్ కోడ్',
                        ),
                        counterText: '',
                      ),
                      validator: (value) =>
                          RegExp(r'^[1-9][0-9]{5}$').hasMatch(value ?? '')
                          ? null
                          : context.tr(
                              'Enter a valid six-digit PIN.',
                              'సరైన ఆరు అంకెల పిన్ నమోదు చేయండి.',
                            ),
                    ),
                    if (app.privateDraft) ...[
                      const SizedBox(height: 16),
                      Text(
                        context.tr(
                          'Demo PIN: 517502. Delivery terms are pending; ordering is disabled.',
                          'డెమో పిన్: 517502. డెలివరీ వివరాలు నిర్ధారించాలి; ఆర్డర్లు నిలిపివేయబడ్డాయి.',
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    if (error != null) FailurePanel(error: error!),
                    BusyButton(
                      key: const ValueKey('address_review'),
                      label: widget.checkout
                          ? context.tr(
                              'Check delivery & total',
                              'డెలివరీ, మొత్తం తనిఖీ చేయండి',
                            )
                          : context.tr('Save address', 'చిరునామా సేవ్ చేయండి'),
                      busy: busy || app.checkoutBusy,
                      onPressed: () => unawaited(review()),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    street.dispose();
    city.dispose();
    pin.dispose();
    super.dispose();
  }
}

class ReviewCheckoutPage extends StatefulWidget {
  const ReviewCheckoutPage({
    super.key,
    required this.checkout,
    required this.onConfirmed,
    required this.onNewQuote,
  });
  final PendingCheckout checkout;
  final void Function(String orderId, PendingCheckout checkout) onConfirmed;
  final VoidCallback onNewQuote;
  @override
  State<ReviewCheckoutPage> createState() => _ReviewCheckoutPageState();
}

class _ReviewCheckoutPageState extends State<ReviewCheckoutPage> {
  AppFailure? error;
  Timer? expiryTimer;
  @override
  void initState() {
    super.initState();
    expiryTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> place() async {
    final app = context.app;
    final original = app.pending;
    if (original?.key != widget.checkout.key) {
      setState(() => error = const AppFailure('QUOTE_CHANGED'));
      return;
    }
    setState(() => error = null);
    try {
      final id = await app.submitPending();
      if (mounted && app.user?.uid == original!.uid) {
        widget.onConfirmed(id, original);
      }
    } catch (failure) {
      if (mounted) setState(() => error = AppFailure.from(failure));
    }
  }

  Future<void> newQuote() async {
    final app = context.app;
    try {
      await app.discardRejectedOrUnattemptedCheckout();
      if (mounted && app.user?.uid == widget.checkout.uid) widget.onNewQuote();
    } catch (failure) {
      if (mounted) setState(() => error = AppFailure.from(failure));
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final pending = app.pending?.key == widget.checkout.key
        ? app.pending!
        : widget.checkout;
    final quote = pending.quote;
    final canRefresh = !pending.attempted || pending.definitivelyRejected;
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('Review your order', 'మీ ఆర్డర్ సమీక్షించండి')),
      ),
      body: SafeArea(
        child: PageBody(
          maxWidth: 560,
          children: [
            if (app.user?.uid != pending.uid)
              FailurePanel(error: const AppFailure('AUTH_REQUIRED'))
            else ...[
              const ModeBanner(),
              const SizedBox(height: 20),
              PageTitle(
                context.tr('Your complete total', 'మీ పూర్తి మొత్తం'),
                description: context.tr(
                  'Check the packs, delivery address and amount before confirming.',
                  'ధృవీకరణకు ముందు ప్యాక్‌లు, చిరునామా, మొత్తాన్ని తనిఖీ చేయండి.',
                ),
              ),
              if (pending.attempted &&
                  pending.orderId == null &&
                  !pending.definitivelyRejected) ...[
                Text(
                  context.tr(
                    'Checking an earlier order request',
                    'మునుపటి ఆర్డర్ అభ్యర్థనను తనిఖీ చేయండి',
                  ),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                Text(
                  context.tr(
                    'Retry uses this original total and address. The same request can create only one order, even if you changed your cart.',
                    'మళ్లీ ప్రయత్నిస్తే ఈ మొదటి మొత్తం, చిరునామానే ఉపయోగిస్తాం. కార్ట్ మారినా అదే అభ్యర్థన నుంచి ఒక్క ఆర్డర్ మాత్రమే వస్తుంది.',
                  ),
                ),
                const SizedBox(height: 24),
              ],
              for (final line in quote.lines) ...[
                TotalRow(
                  context.tr(
                    '${line.litres} L pack × ${line.quantity}',
                    '${line.litres} L ప్యాక్ × ${line.quantity}',
                  ),
                  money(line.totalPaise),
                ),
                Text(
                  '${money(line.unitPricePaise)} ${context.tr('per pack', 'ఒక ప్యాక్‌కు')}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              const Divider(),
              TotalRow(
                context.tr('Products', 'ఉత్పత్తులు'),
                money(quote.subtotalPaise),
              ),
              TotalRow(
                context.tr('Delivery', 'డెలివరీ'),
                money(quote.shippingPaise),
              ),
              TotalRow(
                context.tr('Total to pay', 'చెల్లించాల్సిన మొత్తం'),
                money(quote.totalPaise),
                strong: true,
              ),
              const SizedBox(height: 16),
              Text(quote.estimate),
              const SizedBox(height: 28),
              Text(
                context.tr('Deliver to', 'డెలివరీ చిరునామా'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              Text(pending.address.name),
              Text(pending.address.summary),
              Text('+91 ${pending.address.phone}'),
              const SizedBox(height: 28),
              Text(
                context.tr('Cash on delivery', 'డెలివరీ సమయంలో నగదు'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              Text(
                quote.preview
                    ? context.tr(
                        'This is a preview. No payment or delivery will occur.',
                        'ఇది ప్రివ్యూ. చెల్లింపు లేదా డెలివరీ జరగదు.',
                      )
                    : context.tr(
                        'Pay ${money(quote.totalPaise)} in cash when your order is delivered.',
                        'మీ ఆర్డర్ డెలివరీ అయినప్పుడు ${money(quote.totalPaise)} నగదు చెల్లించండి.',
                      ),
              ),
              const SizedBox(height: 12),
              Text(
                context.tr(
                  'Online payment is unavailable.',
                  'ఆన్‌లైన్ చెల్లింపు అందుబాటులో లేదు.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 24),
              if (quote.expired && !pending.attempted)
                Text(
                  context.tr(
                    'This total has expired. Review a new total.',
                    'ఈ మొత్తం గడువు ముగిసింది. కొత్త మొత్తం సమీక్షించండి.',
                  ),
                ),
              if (pending.definitivelyRejected)
                FailurePanel(error: AppFailure(pending.rejectionCode!)),
              if (error != null) FailurePanel(error: error!),
              BusyButton(
                key: const ValueKey('confirm_cod'),
                busy: app.checkoutBusy,
                label: pending.orderId != null
                    ? context.tr(
                        'View confirmed order',
                        'ధృవీకరించిన ఆర్డర్ చూడండి',
                      )
                    : pending.attempted
                    ? context.tr(
                        'Retry original order',
                        'మొదటి ఆర్డర్‌ను మళ్లీ ప్రయత్నించండి',
                      )
                    : quote.preview
                    ? context.tr(
                        'Confirm preview order',
                        'ప్రివ్యూ ఆర్డర్ ధృవీకరించండి',
                      )
                    : context.tr(
                        'Confirm cash-on-delivery order',
                        'నగదు చెల్లింపు ఆర్డర్ ధృవీకరించండి',
                      ),
                onPressed:
                    app.accountReady &&
                        (pending.attempted || !quote.expired) &&
                        app.pending?.key == pending.key
                    ? () => unawaited(place())
                    : null,
              ),
              if (canRefresh) ...[
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: app.checkoutBusy
                      ? null
                      : () => unawaited(newQuote()),
                  child: Text(
                    context.tr(
                      pending.definitivelyRejected || quote.expired
                          ? 'Review new total'
                          : 'Edit delivery / cart',
                      pending.definitivelyRejected || quote.expired
                          ? 'కొత్త మొత్తం సమీక్షించండి'
                          : 'డెలివరీ / కార్ట్ మార్చండి',
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text(
                context.tr(
                  'A delivery quote lasts ten minutes. Current stock is checked again when you confirm.',
                  'డెలివరీ కోట్ పది నిమిషాలు చెల్లుతుంది. ధృవీకరణ సమయంలో తాజా స్టాక్ మళ్లీ తనిఖీ అవుతుంది.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    expiryTimer?.cancel();
    super.dispose();
  }
}

class OrderConfirmationPage extends StatelessWidget {
  const OrderConfirmationPage({
    super.key,
    required this.orderId,
    required this.checkout,
    required this.onOrders,
    required this.onDetail,
  });
  final String orderId;
  final PendingCheckout checkout;
  final VoidCallback onOrders, onDetail;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(context.tr('Order received', 'ఆర్డర్ స్వీకరించబడింది')),
    ),
    body: SafeArea(
      child: PageBody(
        maxWidth: 560,
        children: [
          if (context.app.user?.uid != checkout.uid)
            FailurePanel(error: const AppFailure('AUTH_REQUIRED'))
          else ...[
            Icon(
              Icons.check_circle_outline,
              size: 72,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 24),
            PageTitle(
              checkout.quote.preview
                  ? context.tr(
                      'Preview order received',
                      'ప్రివ్యూ ఆర్డర్ స్వీకరించబడింది',
                    )
                  : context.tr('Your order is with us', 'మీ ఆర్డర్ అందింది'),
              description: checkout.quote.preview
                  ? context.tr(
                      'This is a sample order. No real payment or delivery will occur.',
                      'ఇది నమూనా ఆర్డర్. నిజమైన చెల్లింపు లేదా డెలివరీ జరగదు.',
                    )
                  : context.tr(
                      'Pay ${money(checkout.quote.totalPaise)} in cash on delivery. Your order status is in Orders.',
                      'డెలివరీ సమయంలో ${money(checkout.quote.totalPaise)} నగదు చెల్లించండి. ఆర్డర్‌లలో మీ స్థితిని చూడండి.',
                    ),
            ),
            SelectableText(
              orderId,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 24),
            TotalRow(
              context.tr('Order total', 'ఆర్డర్ మొత్తం'),
              money(checkout.quote.totalPaise),
              strong: true,
            ),
            Text(checkout.address.summary),
            const SizedBox(height: 28),
            if (context.app.pending?.orderId == orderId)
              Text(
                context.tr(
                  'Your order is confirmed. Cart changes still need syncing; check your cart if it remains visible.',
                  'మీ ఆర్డర్ ధృవీకరించబడింది. కార్ట్ మార్పులను సేవ్ చేయాలి; కార్ట్ ఇంకా కనిపిస్తే తనిఖీ చేయండి.',
                ),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onDetail,
              child: Text(
                context.tr('View order status', 'ఆర్డర్ స్థితి చూడండి'),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onOrders,
              child: Text(context.tr('All my orders', 'నా ఆర్డర్‌లు అన్నీ')),
            ),
          ],
        ],
      ),
    ),
  );
}
