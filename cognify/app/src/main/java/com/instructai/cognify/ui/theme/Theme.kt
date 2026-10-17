package com.instructai.cognify.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val CognifyDarkColorScheme = darkColorScheme(
    primary = CognifyColors.PurpleD,
    onPrimary = CognifyColors.InkD,
    primaryContainer = CognifyColors.PurpleD.copy(alpha = 0.20f),
    onPrimaryContainer = CognifyColors.PurpleD,
    secondary = CognifyColors.OrangeD,
    onSecondary = CognifyColors.BgD,
    tertiary = CognifyColors.BlueD,
    onTertiary = CognifyColors.BgD,
    background = CognifyColors.BgD,
    onBackground = CognifyColors.InkD,
    surface = CognifyColors.CardD,
    onSurface = CognifyColors.InkD,
    surfaceVariant = CognifyColors.FillD,
    onSurfaceVariant = CognifyColors.SubInkD,
    outline = CognifyColors.SeparatorD,
    outlineVariant = CognifyColors.SeparatorD.copy(alpha = 0.55f),
    error = CognifyColors.RedD,
    onError = CognifyColors.InkD,
    errorContainer = CognifyColors.RedD.copy(alpha = 0.18f),
    onErrorContainer = CognifyColors.RedD,
    surfaceTint = Color.Transparent,
    inverseSurface = CognifyColors.InkD,
    inverseOnSurface = CognifyColors.BgD,
    inversePrimary = CognifyColors.PurpleL,
)

private val CognifyLightColorScheme = lightColorScheme(
    primary = CognifyColors.PurpleL,
    onPrimary = CognifyColors.CardL,
    primaryContainer = CognifyColors.PurpleL.copy(alpha = 0.14f),
    onPrimaryContainer = CognifyColors.PurpleL,
    secondary = CognifyColors.OrangeL,
    onSecondary = CognifyColors.CardL,
    tertiary = CognifyColors.BlueL,
    onTertiary = CognifyColors.CardL,
    background = CognifyColors.BgL,
    onBackground = CognifyColors.InkL,
    surface = CognifyColors.CardL,
    onSurface = CognifyColors.InkL,
    surfaceVariant = CognifyColors.FillL,
    onSurfaceVariant = CognifyColors.SubInkL,
    outline = CognifyColors.SeparatorL,
    outlineVariant = CognifyColors.SeparatorL.copy(alpha = 0.55f),
    error = CognifyColors.RedL,
    onError = CognifyColors.CardL,
    errorContainer = CognifyColors.RedL.copy(alpha = 0.12f),
    onErrorContainer = CognifyColors.RedL,
    surfaceTint = Color.Transparent,
    inverseSurface = CognifyColors.InkL,
    inverseOnSurface = CognifyColors.CardL,
    inversePrimary = CognifyColors.PurpleD,
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

    CompositionLocalProvider(LocalIsDarkTheme provides darkTheme) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = CognifyTypography,
            shapes = CognifyShapes,
            content = content,
        )
    }
}
