import 'package:flutter/material.dart';

ThemeData brandTheme({required bool dark, required String language}) {
  final scheme =
      ColorScheme.fromSeed(
        seedColor: const Color(0xff183a28),
        brightness: dark ? Brightness.dark : Brightness.light,
      ).copyWith(
        primary: dark ? const Color(0xffb8d8ae) : const Color(0xff183a28),
        onPrimary: dark ? const Color(0xff102b1a) : Colors.white,
        secondary: dark ? const Color(0xffe1b640) : const Color(0xff70543e),
        secondaryContainer: dark
            ? const Color(0xff493812)
            : const Color(0xfff8edce),
        onSecondaryContainer: dark
            ? const Color(0xffffe7a1)
            : const Color(0xff513b0b),
        tertiary: dark ? const Color(0xffcdad91) : const Color(0xff70543e),
        surface: dark ? const Color(0xff101b15) : Colors.white,
        onSurface: dark ? const Color(0xffe5eee1) : const Color(0xff202720),
        surfaceContainerLow: dark
            ? const Color(0xff17241c)
            : const Color(0xfff3f6ec),
        surfaceContainer: dark
            ? const Color(0xff233426)
            : const Color(0xffedf1e5),
        onSurfaceVariant: dark
            ? const Color(0xffb3c0ae)
            : const Color(0xff626b60),
        outline: dark ? const Color(0xff697564) : const Color(0xff87907f),
        outlineVariant: dark
            ? const Color(0xff435441)
            : const Color(0xffdce2d4),
        error: dark ? const Color(0xffffb4ab) : const Color(0xffa12c2c),
      );
  final body = language == 'te' ? 'NotoTelugu' : 'SourceSans3';
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: body,
  );
  final text = base.textTheme.apply(
    fontFamily: body,
    fontFamilyFallback: const ['NotoTelugu', 'SourceSans3'],
  );
  final displayFamily = language == 'te' ? 'AnekTelugu' : 'Anek';
  TextStyle headline(TextStyle? value, double size) => value!.copyWith(
    fontFamily: displayFamily,
    fontFamilyFallback: const ['AnekTelugu', 'NotoTelugu'],
    fontSize: size,
    fontWeight: FontWeight.w600,
    height: language == 'te' ? 1.5 : 1.15,
    color: scheme.primary,
  );
  final radius = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(12),
  );
  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    textTheme: text.copyWith(
      displaySmall: headline(text.displaySmall, 36),
      headlineLarge: headline(text.headlineLarge, 32),
      headlineMedium: headline(text.headlineMedium, 28),
      headlineSmall: headline(text.headlineSmall, 24),
      titleLarge: text.titleLarge!.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        height: 1.4,
      ),
      titleMedium: text.titleMedium!.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        height: 1.4,
      ),
      bodyLarge: text.bodyLarge!.copyWith(
        fontSize: 18,
        height: language == 'te' ? 1.7 : 1.45,
      ),
      bodyMedium: text.bodyMedium!.copyWith(
        fontSize: 16,
        height: language == 'te' ? 1.7 : 1.45,
      ),
      bodySmall: text.bodySmall!.copyWith(fontSize: 14, height: 1.5),
      labelLarge: text.labelLarge!.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        height: 1.4,
      ),
      labelMedium: text.labelMedium!.copyWith(fontSize: 13, height: 1.4),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      foregroundColor: scheme.primary,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: radius,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: radius,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      errorMaxLines: 3,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surfaceContainerLow,
      indicatorColor: scheme.surfaceContainer,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => text.labelMedium!.copyWith(
          color: states.contains(WidgetState.selected)
              ? scheme.primary
              : scheme.onSurfaceVariant,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w400,
        ),
      ),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: scheme.surfaceContainerLow,
      indicatorColor: scheme.surfaceContainer,
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant,
      thickness: 1,
      space: 32,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: radius,
    ),
  );
}
