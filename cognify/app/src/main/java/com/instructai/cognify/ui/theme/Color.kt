package com.instructai.cognify.ui.theme

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/*
 * Apple system palette (iOS). Each color ships a light and a dark variant,
 * matching UIColor's dynamic system colors; ScreenText.kt / Tints.kt pick
 * between them via LocalIsDarkTheme (provided by CognifyTheme).
 */

/** True while the app renders its dark scheme, regardless of the source (system or user override). */
val LocalIsDarkTheme = staticCompositionLocalOf { false }

data class Tint(val fg: Color, val soft: Color)

object CognifyColors {

    // ---- iOS system accents: light / dark ----
    val PurpleL = Color(0xFFAF52DE); val PurpleD = Color(0xFFBF5AF2)   // brand accent (Cognify purple, Apple-flavored)
    val BlueL = Color(0xFF007AFF);   val BlueD = Color(0xFF0A84FF)
    val GreenL = Color(0xFF34C759);  val GreenD = Color(0xFF30D158)
    val RedL = Color(0xFFFF3B30);    val RedD = Color(0xFFFF453A)
    val OrangeL = Color(0xFFFF9500); val OrangeD = Color(0xFFFF9F0A)
    val TealL = Color(0xFF30B0C7);   val TealD = Color(0xFF40C8E0)
    val IndigoL = Color(0xFF5856D6); val IndigoD = Color(0xFF5E5CE6)
    val YellowL = Color(0xFFFFCC00); val YellowD = Color(0xFFFFD60A)

    // ---- Neutrals: light ----
    val BgL = Color(0xFFF2F2F7)         // systemGroupedBackground
    val CardL = Color(0xFFFFFFFF)       // secondarySystemGroupedBackground
    val FillL = Color(0xFFE5E5EA)       // systemFill (skeletons, tracks)
    val InkL = Color(0xFF000000)        // label
    val SubInkL = Color(0x993C3C43)     // secondaryLabel
    val HintL = Color(0x4D3C3C43)       // tertiaryLabel
    val SeparatorL = Color(0xFFD1D1D6)

    // ---- Neutrals: dark ----
    val BgD = Color(0xFF000000)
    val CardD = Color(0xFF1C1C1E)       // secondarySystemGroupedBackground
    val FillD = Color(0xFF2C2C2E)       // tertiarySystemFill
    val InkD = Color(0xFFFFFFFF)
    val SubInkD = Color(0x99EBEBF5)     // secondaryLabel
    val HintD = Color(0x4DEBEBF5)       // tertiaryLabel
    val SeparatorD = Color(0xFF38383A)

    // Rotating tints for reviewer icon chips — flat Apple-style colored glyphs.
    fun accent(isDark: Boolean) = if (isDark) PurpleD else PurpleL

    private val accentsLight = listOf(PurpleL, BlueL, TealL, OrangeL, GreenL, IndigoL)
    private val accentsDark = listOf(PurpleD, BlueD, TealD, OrangeD, GreenD, IndigoD)

    /** A flat tinted chip (fg = glyph color, soft = 12% wash over the card). */
    fun chipTint(index: Int, isDark: Boolean): Tint {
        val fg = if (isDark) accentsDark[index % accentsDark.size] else accentsLight[index % accentsLight.size]
        return Tint(fg = fg, soft = fg.copy(alpha = 0.13f))
    }

    object Semantics {
        fun success(isDark: Boolean) = if (isDark) GreenD else GreenL
        fun danger(isDark: Boolean) = if (isDark) RedD else RedL
        fun warning(isDark: Boolean) = if (isDark) OrangeD else OrangeL
        fun info(isDark: Boolean) = if (isDark) BlueD else BlueL
    }
}
