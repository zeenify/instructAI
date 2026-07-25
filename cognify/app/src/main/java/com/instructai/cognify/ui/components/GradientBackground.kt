package com.instructai.cognify.ui.components

import androidx.compose.foundation.background
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import com.instructai.cognify.ui.theme.CognifyGradients

@Composable
fun Modifier.navyBackground(): Modifier = this.then(
    Modifier.background(CognifyGradients.navy)
)

@Composable
fun Modifier.gradientTop(): Modifier = this.then(
    Modifier.background(
        Brush.verticalGradient(
            0f to androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.3f),
            1f to androidx.compose.ui.graphics.Color.Transparent,
        )
    )
)
