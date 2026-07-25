package com.instructai.cognify.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val CognifyDarkColorScheme = darkColorScheme(
    primary = CognifyColors.ElectricViolet,
    onPrimary = CognifyColors.DeepNavy,
    primaryContainer = CognifyColors.ElectricVioletDark,
    onPrimaryContainer = CognifyColors.ElectricVioletLight,
    secondary = CognifyColors.Gold,
    onSecondary = CognifyColors.DeepNavy,
    secondaryContainer = CognifyColors.GoldDark,
    onSecondaryContainer = CognifyColors.GoldLight,
    tertiary = CognifyColors.ElectricVioletLight,
    onTertiary = CognifyColors.DeepNavy,
    background = CognifyColors.DeepNavy,
    onBackground = CognifyColors.Silver,
    surface = CognifyColors.DeepNavyLight,
    onSurface = CognifyColors.Silver,
    surfaceVariant = CognifyColors.Midnight,
    onSurfaceVariant = CognifyColors.Silver.copy(alpha = 0.7f),
    outline = CognifyColors.Charcoal,
    outlineVariant = CognifyColors.Charcoal.copy(alpha = 0.5f),
    error = CognifyColors.Error,
    onError = CognifyColors.DeepNavy,
    errorContainer = CognifyColors.Error.copy(alpha = 0.15f),
    onErrorContainer = CognifyColors.Error,
    surfaceTint = CognifyColors.ElectricViolet,
    inverseSurface = CognifyColors.Silver,
    inverseOnSurface = CognifyColors.DeepNavy,
    inversePrimary = CognifyColors.ElectricVioletDark,
)

private val CognifyLightColorScheme = lightColorScheme(
    primary = CognifyColors.ElectricViolet,
    onPrimary = CognifyColors.DeepNavy,
    primaryContainer = CognifyColors.ElectricVioletLight,
    onPrimaryContainer = CognifyColors.ElectricVioletDark,
    secondary = CognifyColors.GoldDark,
    onSecondary = CognifyColors.DeepNavy,
    secondaryContainer = CognifyColors.GoldLight,
    onSecondaryContainer = CognifyColors.GoldDark,
    tertiary = CognifyColors.ElectricVioletDark,
    onTertiary = CognifyColors.DeepNavy,
    background = CognifyColors.SurfaceLight,
    onBackground = CognifyColors.DeepNavy,
    surface = CognifyColors.CardLight,
    onSurface = CognifyColors.DeepNavy,
    surfaceVariant = CognifyColors.SurfaceLight,
    onSurfaceVariant = CognifyColors.DeepNavyLight,
    outline = CognifyColors.Silver,
    outlineVariant = CognifyColors.Silver.copy(alpha = 0.5f),
    error = CognifyColors.Error,
    onError = CognifyColors.CardLight,
    errorContainer = CognifyColors.Error.copy(alpha = 0.1f),
    onErrorContainer = CognifyColors.Error,
    surfaceTint = CognifyColors.ElectricViolet,
    inverseSurface = CognifyColors.DeepNavy,
    inverseOnSurface = CognifyColors.Silver,
    inversePrimary = CognifyColors.ElectricVioletLight,
)

@Composable
fun CognifyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) CognifyDarkColorScheme else CognifyLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CognifyTypography,
        shapes = CognifyShapes,
        content = content,
    )
}
