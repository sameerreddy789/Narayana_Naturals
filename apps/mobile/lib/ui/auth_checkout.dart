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
  final phone = TextEditingController();
  final code = TextEditingController();
  final phoneForm = GlobalKey<FormState>(), codeForm = GlobalKey<FormState>();
  AppController? controller;
  String? verificationId;
  int? resendToken;
  DateTime? resendAt;
  Timer? ticker;
  AppFailure? error;
  bool busy = false, autoTimedOut = false, completing = false;
  int request = 0;
  String? requestedPhone;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (controller == null) {
      controller = context.app;
      controller!.addListener(authChanged);
      if (controller!.preview) phone.text = '6000000001';
    }
  }

  void authChanged() {
    if (!mounted ||
        completing ||
        controller?.accountReady != true ||
        controller?.user?.phone != requestedPhone) {
      return;
    }
    completing = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).pop(true);
    });
  }

  int get resendSeconds => resendAt == null
      ? 0
      : resendAt!.difference(DateTime.now()).inSeconds.clamp(0, 60);
  Future<void> sendCode({bool resend = false}) async {
    if (!phoneForm.currentState!.validate()) return;
    final app = controller!;
    final currentRequest = ++request;
    requestedPhone = '+91${phone.text.trim()}';
    setState(() {
      busy = true;
      error = null;
      autoTimedOut = false;
    });
    if (app.backend.mode == BackendMode.demo) {
      try {
        await app.backend.signInPreview(requestedPhone!);
      } catch (failure) {
        if (mounted) setState(() => error = AppFailure.from(failure));
      }
      if (mounted) setState(() => busy = false);
      authChanged();
      return;
    }
    bool active() => mounted && request == currentRequest;
    try {
      await app.backend.requestPhoneCode(
        requestedPhone!,
        resendToken: resend ? resendToken : null,
        acceptCredential: active,
        codeSent: (id, token) {
          if (!active()) return;
          setState(() {
            verificationId = id;
            resendToken = token;
            busy = false;
            resendAt = DateTime.now().add(const Duration(seconds: 60));
          });
          ticker?.cancel();
          ticker = Timer.periodic(const Duration(seconds: 1), (_) {
            if (!mounted) return;
            setState(() {});
            if (resendSeconds == 0) ticker?.cancel();
          });
        },
        failed: (failure) {
          if (active()) {
            setState(() {
              error = failure;
              busy = false;
            });
          }
        },
        authenticated: () {
          if (active()) {
            setState(() => busy = false);
            authChanged();
          }
        },
        timedOut: () {
          if (active()) {
            setState(() {
              busy = false;
              autoTimedOut = true;
            });
          }
        },
      );
    } catch (failure) {
      if (active()) {
        setState(() {
          error = AppFailure.from(failure);
          busy = false;
        });
      }
    }
  }

  Future<void> verifyCode() async {
    if (!codeForm.currentState!.validate() || verificationId == null) return;
    final currentRequest = request;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await controller!.backend.confirmPhoneCode(
        verificationId!,
        code.text.trim(),
      );
      authChanged();
    } catch (failure) {
      if (mounted && currentRequest == request) {
        setState(() => error = AppFailure.from(failure));
      }
    } finally {
      if (mounted && currentRequest == request) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final preview = app.backend.mode == BackendMode.demo;
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('Phone sign-in', 'ఫోన్ సైన్ ఇన్'))),
      body: SafeArea(
        child: PageBody(
          maxWidth: 560,
          children: [
            const ModeBanner(),
            const SizedBox(height: 24),
            PageTitle(
              context.tr(
                'One phone. Your cart and orders.',
                'ఒక ఫోన్. మీ కార్ట్, ఆర్డర్‌లు.',
              ),
              description: preview
                  ? context.tr(
                      'Use a preview phone account. No SMS is sent and nothing leaves this device.',
                      'ప్రివ్యూ ఫోన్ ఖాతాను ఉపయోగించండి. ఎస్‌ఎమ్‌ఎస్ పంపబడదు; ఈ పరికరం నుంచి సమాచారం బయటకు వెళ్లదు.',
                    )
                  : context.tr(
                      'Sign in with the same number you use on the website.',
                      'వెబ్‌సైట్‌లో ఉపయోగించే అదే నంబర్‌తో సైన్ ఇన్ చేయండి.',
                    ),
            ),
            const LanguageChoice(),
            const SizedBox(height: 24),
            Form(
              key: phoneForm,
              child: TextFormField(
                key: const ValueKey('sign_in_phone'),
                controller: phone,
                enabled: verificationId == null && !busy,
                keyboardType: TextInputType.phone,
                autofillHints: const [AutofillHints.telephoneNumberNational],
                maxLength: 10,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(
                  labelText: context.tr('Mobile number', 'మొబైల్ నంబర్'),
                  prefixText: '+91 ',
                  counterText: '',
                ),
                validator: (value) =>
                    RegExp(r'^[6-9][0-9]{9}$').hasMatch(value?.trim() ?? '')
                    ? null
                    : context.tr(
                        'Enter 10 digits starting with 6, 7, 8 or 9.',
                        '6, 7, 8 లేదా 9 తో ప్రారంభమయ్యే 10 అంకెలు నమోదు చేయండి.',
                      ),
              ),
            ),
            const SizedBox(height: 16),
            if (!preview && verificationId == null)
              Text(
                context.tr(
                  'Continue sends a verification SMS. Google processes your phone number to verify your account and prevent abuse.',
                  'కొనసాగిస్తే ధృవీకరణ ఎస్‌ఎమ్‌ఎస్ వస్తుంది. ఖాతా ధృవీకరణ, దుర్వినియోగ నివారణ కోసం గూగుల్ మీ ఫోన్ నంబర్‌ను ప్రాసెస్ చేస్తుంది.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            if (app.backend.mode == BackendMode.emulator)
              Text(
                context.tr(
                  'No real SMS. Read the verification code from the local Auth emulator.',
                  'నిజమైన ఎస్‌ఎమ్‌ఎస్ లేదు. స్థానిక ఆత్ ఎమ్యులేటర్‌లో ధృవీకరణ కోడ్‌ను చూడండి.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            if (verificationId != null) ...[
              Text(
                context.tr(
                  'Enter the six-digit code sent to +91 ${phone.text}.',
                  '+91 ${phone.text} కు పంపిన ఆరు అంకెల కోడ్ నమోదు చేయండి.',
                ),
              ),
              const SizedBox(height: 20),
              Form(
                key: codeForm,
                child: TextFormField(
                  key: const ValueKey('sign_in_code'),
                  controller: code,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => unawaited(verifyCode()),
                  decoration: InputDecoration(
                    labelText: context.tr('Verification code', 'ధృవీకరణ కోడ్'),
                    counterText: '',
                  ),
                  validator: (value) =>
                      RegExp(r'^[0-9]{6}$').hasMatch(value ?? '')
                      ? null
                      : context.tr(
                          'Enter all six digits.',
                          'ఆరు అంకెలు నమోదు చేయండి.',
                        ),
                ),
              ),
              const SizedBox(height: 16),
              if (autoTimedOut)
                Text(
                  context.tr(
                    'Automatic verification timed out. You can enter the SMS code above.',
                    'ఆటోమేటిక్ ధృవీకరణ గడువు ముగిసింది. పైన ఎస్‌ఎమ్‌ఎస్ కోడ్ నమోదు చేయవచ్చు.',
                  ),
                ),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  TextButton(
                    onPressed: !busy && resendSeconds == 0
                        ? () => unawaited(sendCode(resend: true))
                        : null,
                    child: Text(
                      resendSeconds == 0
                          ? context.tr('Resend code', 'కోడ్ మళ్లీ పంపండి')
                          : context.tr(
                              'Resend in ${resendSeconds}s',
                              '$resendSeconds సెకన్లలో మళ్లీ పంపండి',
                            ),
                    ),
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () => setState(() {
                            request++;
                            verificationId = null;
                            resendToken = null;
                            code.clear();
                            ticker?.cancel();
                            error = null;
                          }),
                    child: Text(context.tr('Change phone', 'ఫోన్ మార్చండి')),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            if (error != null) FailurePanel(error: error!),
            if (app.accountError != null)
              FailurePanel(
                error: app.accountError!,
                title: context.tr(
                  'Signed in. Your account could not load.',
                  'సైన్ ఇన్ అయింది. మీ ఖాతా లోడ్ కాలేదు.',
                ),
                onRetry: () => unawaited(app.retryAccount()),
              ),
            if (app.accountLoading)
              LoadingState(
                label: context.tr(
                  'Loading your saved cart and orders…',
                  'మీ సేవ్ చేసిన కార్ట్, ఆర్డర్‌లు లోడ్ అవుతున్నాయి…',
                ),
              ),
            BusyButton(
              key: const ValueKey('sign_in_continue'),
              label: preview
                  ? context.tr('Continue in preview', 'ప్రివ్యూలో కొనసాగించండి')
                  : verificationId == null
                  ? context.tr('Send verification code', 'ధృవీకరణ కోడ్ పంపండి')
                  : context.tr('Verify & continue', 'ధృవీకరించి కొనసాగించండి'),
              busy: busy || app.accountLoading,
              onPressed: () =>
                  unawaited(verificationId == null ? sendCode() : verifyCode()),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    request++;
    ticker?.cancel();
    controller?.removeListener(authChanged);
    phone.dispose();
    code.dispose();
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
              'Your phone account keeps your cart, address and orders together across the website and app.',
              'మీ ఫోన్ ఖాతా వెబ్‌సైట్, యాప్‌లో కార్ట్, చిరునామా, ఆర్డర్‌లను ఒకే చోట ఉంచుతుంది.',
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
      phone.text =
          address?.phone ?? (app.user?.phone?.replaceFirst('+91', '') ?? '');
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
                    if (app.preview) ...[
                      const SizedBox(height: 16),
                      Text(
                        context.tr(
                          'Preview PINs: 517001 / 517501 local, 560001 courier.',
                          'ప్రివ్యూ పిన్‌లు: 517001 / 517501 స్థానికం, 560001 కొరియర్.',
                        ),
                      ),
                      TextButton(
                        key: const ValueKey('preview_address'),
                        onPressed: () => setState(() {
                          name.text = 'Preview Customer';
                          street.text = '10 Sample Street';
                          city.text = 'Chittoor';
                          pin.text = '517001';
                        }),
                        child: Text(
                          context.tr(
                            'Fill sample preview address',
                            'నమూనా ప్రివ్యూ చిరునామా పూరించండి',
                          ),
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
