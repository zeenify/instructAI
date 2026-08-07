package com.instructai.cognify.ui.flashcards

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.ui.components.ConfettiOverlay
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.CognifyGradients
import kotlin.math.abs
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FlashcardDeckScreen(
    reviewId: Long,
    onBack: () -> Unit,
    viewModel: FlashcardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(reviewId) {
        viewModel.loadFlashcards(reviewId)
    }

    if (state.isSessionComplete) {
        SessionCompleteScreen(
            known = state.cardsKnown,
            unknown = state.cardsUnknown,
            total = state.cardsReviewed,
            onRestart = { viewModel.resetSession() },
            onBack = onBack,
        )
        return
    }

    if (state.isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Loading flashcards...", style = MaterialTheme.typography.bodyLarge)
        }
        return
    }

    if (state.flashcards.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("No flashcards yet", style = MaterialTheme.typography.headlineSmall)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Generate flashcards from your reviewer to start studying",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        return
    }

    val currentCard = state.flashcards.getOrNull(state.currentIndex) ?: return
    val scope = rememberCoroutineScope()
    val slideAnim = remember { Animatable(0f) }
    var isSwiping by remember { mutableStateOf(false) }
    val swipeThreshold = 200f

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Flashcards",
                        style = MaterialTheme.typography.titleMedium,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Progress
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${state.currentIndex + 1} / ${state.flashcards.size}",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { (state.currentIndex + 1).toFloat() / state.flashcards.size.toFloat() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(50)),
                color = CognifyColors.ElectricViolet,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Spacer(modifier = Modifier.weight(1f))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .graphicsLayer {
                        translationX = slideAnim.value
                        rotationZ = slideAnim.value / 20f
                        alpha = ((2000f - abs(slideAnim.value)) / 2000f).coerceIn(0f, 1f)
                    }
                    .pointerInput(Unit) {
                        detectHorizontalDragGestures(
                            onDragStart = { isSwiping = true },
                            onDragEnd = {
                                isSwiping = false
                                if (slideAnim.value > swipeThreshold) {
                                    scope.launch {
                                        slideAnim.animateTo(2000f, tween(200))
                                        viewModel.rateCard(4)
                                        slideAnim.snapTo(0f)
                                    }
                                } else if (slideAnim.value < -swipeThreshold) {
                                    scope.launch {
                                        slideAnim.animateTo(-2000f, tween(200))
                                        viewModel.rateCard(0)
                                        slideAnim.snapTo(0f)
                                    }
                                } else {
                                    scope.launch { slideAnim.animateTo(0f, spring(stiffness = Spring.StiffnessMediumLow)) }
                                }
                            },
                            onHorizontalDrag = { _, dragAmount ->
                                if (!isSwiping) isSwiping = true
                                scope.launch {
                                    slideAnim.snapTo((slideAnim.value + dragAmount).coerceIn(-2000f, 2000f))
                                }
                            },
                        )
                    },
            ) {
                FlipCard(
                    frontText = currentCard.frontText,
                    backText = currentCard.backText,
                    isFlipped = state.isFlipped,
                    onTap = { viewModel.flipCard() },
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            // Action buttons
            if (state.isFlipped) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Button(
                        onClick = {
                            scope.launch {
                                slideAnim.animateTo(-2000f, tween(300))
                                viewModel.rateCard(0)
                                slideAnim.snapTo(0f)
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(56.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CognifyColors.Error.copy(alpha = 0.15f),
                        ),
                    ) {
                        Icon(Icons.Filled.Close, contentDescription = null, tint = CognifyColors.Error)
                        Spacer(modifier = Modifier.size(8.dp))
                        Text("Don't Know", color = CognifyColors.Error, fontWeight = FontWeight.SemiBold)
                    }

                    Button(
                        onClick = {
                            scope.launch {
                                slideAnim.animateTo(2000f, tween(300))
                                viewModel.rateCard(4)
                                slideAnim.snapTo(0f)
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(56.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CognifyColors.Success.copy(alpha = 0.15f),
                        ),
                    ) {
                        Icon(Icons.Filled.ThumbUp, contentDescription = null, tint = CognifyColors.Success)
                        Spacer(modifier = Modifier.size(8.dp))
                        Text("Got It", color = CognifyColors.Success, fontWeight = FontWeight.SemiBold)
                    }
                }
            } else {
                Text(
                    "Tap the card to reveal the answer",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                )
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
}

@Composable
private fun FlipCard(
    frontText: String,
    backText: String,
    isFlipped: Boolean,
    onTap: () -> Unit,
) {
    key(frontText) {
        val rotation by animateFloatAsState(
            targetValue = if (isFlipped) 180f else 0f,
            animationSpec = tween(400),
            label = "rotation",
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp)
                .graphicsLayer {
                    rotationY = rotation
                    cameraDistance = 12f * density
                },
        contentAlignment = Alignment.Center,
    ) {
        Card(
            onClick = onTap,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    alpha = if (rotation <= 90f) 1f else 0f
                },
            shape = RoundedCornerShape(20.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface,
            ),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = CognifyGradients.card,
                        shape = RoundedCornerShape(20.dp),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "QUESTION",
                        style = MaterialTheme.typography.labelSmall,
                        color = CognifyColors.ElectricVioletLight,
                        letterSpacing = 2.sp,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = frontText,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }

        Card(
            onClick = onTap,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    alpha = if (rotation > 90f) 1f else 0f
                    rotationY = 180f
                },
            shape = RoundedCornerShape(20.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            colors = CardDefaults.cardColors(
                containerColor = CognifyColors.DeepNavyLight,
            ),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                            listOf(
                                CognifyColors.ElectricViolet.copy(alpha = 0.1f),
                                CognifyColors.DeepNavyLight,
                            )
                        ),
                        shape = RoundedCornerShape(20.dp),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "ANSWER",
                        style = MaterialTheme.typography.labelSmall,
                        color = CognifyColors.GoldLight,
                        letterSpacing = 2.sp,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = backText,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        color = CognifyColors.GoldLight,
                    )
                }
            }
        }
    }
    }
}

@Composable
private fun SessionCompleteScreen(
    known: Int,
    unknown: Int,
    total: Int,
    onRestart: () -> Unit,
    onBack: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        ConfettiOverlay(visible = true)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "Session Complete!",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(32.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$known",
                        style = MaterialTheme.typography.displayLarge,
                        fontWeight = FontWeight.Bold,
                        color = CognifyColors.Success,
                    )
                    Text("Known", style = MaterialTheme.typography.bodyMedium)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$unknown",
                        style = MaterialTheme.typography.displayLarge,
                        fontWeight = FontWeight.Bold,
                        color = CognifyColors.Error,
                    )
                    Text("Review", style = MaterialTheme.typography.bodyMedium)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$total",
                        style = MaterialTheme.typography.displayLarge,
                        fontWeight = FontWeight.Bold,
                        color = CognifyColors.ElectricViolet,
                    )
                    Text("Total", style = MaterialTheme.typography.bodyMedium)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "${(known.toFloat() / total * 100).toInt()}% accuracy",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(modifier = Modifier.height(40.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Button(
                    onClick = onBack,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CognifyColors.ElectricViolet,
                    ),
                ) {
                    Text("Done")
                }
                Button(
                    onClick = onRestart,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CognifyColors.ElectricViolet.copy(alpha = 0.7f),
                    ),
                ) {
                    Icon(Icons.Filled.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("Again")
                }
            }
        }
    }
}
