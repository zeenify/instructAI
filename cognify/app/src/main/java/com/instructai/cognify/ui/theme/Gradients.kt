package com.instructai.cognify.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

object CognifyGradients {
    val primary = Brush.horizontalGradient(
        colors = listOf(CognifyColors.ElectricViolet, CognifyColors.ElectricVioletDark)
    )

    val primaryVertical = Brush.verticalGradient(
        colors = listOf(CognifyColors.ElectricViolet, CognifyColors.ElectricVioletDark)
    )

    val gold = Brush.horizontalGradient(
        colors = listOf(CognifyColors.Gold, CognifyColors.GoldDark)
    )

    val success = Brush.horizontalGradient(
        colors = listOf(CognifyColors.Success, CognifyColors.Success.copy(alpha = 0.8f))
    )

    val error = Brush.horizontalGradient(
        colors = listOf(CognifyColors.Error, CognifyColors.Error.copy(alpha = 0.8f))
    )

    val navy = Brush.verticalGradient(
        colors = listOf(CognifyColors.DeepNavy, CognifyColors.DeepNavyLight)
    )

    val card = Brush.verticalGradient(
        colors = listOf(CognifyColors.DeepNavyLight, CognifyColors.Midnight)
    )

    val glass = Brush.horizontalGradient(
        colors = listOf(Color(0x33FFFFFF), Color(0x0DFFFFFF))
    )

    val accentPair = listOf(CognifyColors.ElectricViolet, CognifyColors.Gold)

    val studyModes = listOf(
        Brush.horizontalGradient(listOf(CognifyColors.ElectricViolet, CognifyColors.ElectricVioletDark)),
        Brush.horizontalGradient(listOf(CognifyColors.Gold, CognifyColors.GoldDark)),
        Brush.horizontalGradient(listOf(CognifyColors.Success, CognifyColors.Success.copy(alpha = 0.8f))),
        Brush.horizontalGradient(listOf(CognifyColors.Info, CognifyColors.Info.copy(alpha = 0.8f))),
        Brush.horizontalGradient(listOf(CognifyColors.Error, CognifyColors.Error.copy(alpha = 0.8f))),
    )
}
