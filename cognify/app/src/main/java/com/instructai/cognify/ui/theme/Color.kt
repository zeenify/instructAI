package com.instructai.cognify.ui.theme

import androidx.compose.ui.graphics.Color

// Core brand palette
object CognifyColors {
    val DeepNavy = Color(0xFF0D0D1A)
    val DeepNavyLight = Color(0xFF1A1A2E)
    val Midnight = Color(0xFF16213E)
    val ElectricViolet = Color(0xFF7C4DFF)
    val ElectricVioletLight = Color(0xFFB388FF)
    val ElectricVioletDark = Color(0xFF651FFF)
    val Gold = Color(0xFFFFD700)
    val GoldLight = Color(0xFFFFE44D)
    val GoldDark = Color(0xFFFFC107)
    val Silver = Color(0xFFE0E0E8)
    val Charcoal = Color(0xFF2A2A3E)

    // Semantic
    val Success = Color(0xFF00E676)
    val Error = Color(0xFFFF5252)
    val Warning = Color(0xFFFFD740)
    val Info = Color(0xFF40C4FF)

    // Gradients
    val PrimaryGradient = listOf(Color(0xFF7C4DFF), Color(0xFF651FFF))
    val GoldGradient = listOf(Color(0xFFFFD700), Color(0xFFFFC107))
    val SuccessGradient = listOf(Color(0xFF00E676), Color(0xFF00C853))
    val ErrorGradient = listOf(Color(0xFFFF5252), Color(0xFFD32F2F))
    val NavyGradient = listOf(Color(0xFF0D0D1A), Color(0xFF1A1A2E))
    val GlassGradient = listOf(Color(0x33FFFFFF), Color(0x0DFFFFFF))
    val CardGradient = listOf(Color(0xFF1A1A2E), Color(0xFF16213E))

    // Surfaces
    val SurfaceLight = Color(0xFFF5F5FA)
    val SurfaceDark = Color(0xFF0D0D1A)
    val CardLight = Color(0xFFFFFFFF)
    val CardDark = Color(0xFF1A1A2E)
    val CardDarkAlt = Color(0xFF16213E)

    // Overlay
    val Scrim = Color(0x99000000)
    val Glass = Color(0x1AFFFFFF)
}
