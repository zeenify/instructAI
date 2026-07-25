package com.instructai.cognify.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import kotlin.random.Random

data class ConfettiParticle(
    val x: Float = Random.nextFloat(),
    val y: Float = Random.nextFloat() * -1f,
    val size: Float = Random.nextFloat() * 8f + 4f,
    val color: Color = Color(
        red = Random.nextFloat(),
        green = Random.nextFloat(),
        blue = Random.nextFloat(),
        alpha = 0.8f,
    ),
    val rotation: Float = Random.nextFloat() * 360f,
    val speed: Float = Random.nextFloat() * 0.003f + 0.002f,
    val drift: Float = Random.nextFloat() * 0.002f - 0.001f,
)

@Composable
fun ConfettiOverlay(
    visible: Boolean,
    modifier: Modifier = Modifier,
) {
    if (!visible) return

    val particles = remember {
        (1..30).map { ConfettiParticle() }
    }

    val infiniteTransition = rememberInfiniteTransition()
    val progress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(5000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        particles.forEach { particle ->
            val currentY = (particle.y + progress * particle.speed * size.height) % size.height
            val currentX = particle.x * size.width + progress * particle.drift * size.width
            rotate(
                degrees = particle.rotation + progress * 360f,
                pivot = Offset(currentX, currentY),
            ) {
                drawRect(
                    color = particle.color,
                    topLeft = Offset(currentX, currentY),
                    size = Size(particle.size, particle.size),
                )
            }
        }
    }
}
