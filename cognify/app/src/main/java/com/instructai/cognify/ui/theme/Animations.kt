package com.instructai.cognify.ui.theme

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.spring

object CognifyAnimations {
    val defaultDuration = 300
    val fastDuration = 150
    val slowDuration = 600

    val spring = spring<Float>(
        dampingRatio = 0.5f,
        stiffness = 300f,
    )

    val springBouncy = spring<Float>(
        dampingRatio = 0.3f,
        stiffness = 200f,
    )

    val easeInOut = tween<Float>(
        durationMillis = defaultDuration,
        easing = FastOutSlowInEasing,
    )

    val fadeIn = tween<Float>(
        durationMillis = defaultDuration,
        easing = FastOutSlowInEasing,
    )

    val slideIn = tween<Int>(
        durationMillis = defaultDuration,
        easing = FastOutSlowInEasing,
    )
}
