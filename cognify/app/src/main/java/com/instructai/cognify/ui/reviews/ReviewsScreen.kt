package com.instructai.cognify.ui.reviews

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Style
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.CognifyGradients
import kotlinx.coroutines.delay

private data class CardTheme(
    val icon: ImageVector,
    val gradient: List<Color>,
    val blobColors: List<Color>,
)

private val cardThemes = listOf(
    CardTheme(Icons.Filled.AutoAwesome, listOf(CognifyColors.ElectricViolet, Color(0xFF651FFF)), listOf(Color(0xFFE040FB), Color(0xFF7C4DFF))),
    CardTheme(Icons.Filled.Psychology, listOf(CognifyColors.Gold, Color(0xFFFF8F00)), listOf(Color(0xFFFFD740), Color(0xFFFFAB00))),
    CardTheme(Icons.Filled.Lightbulb, listOf(Color(0xFF00BCD4), Color(0xFF0097A7)), listOf(Color(0xFF80DEEA), Color(0xFF26C6DA))),
    CardTheme(Icons.Filled.RocketLaunch, listOf(Color(0xFFFF5252), Color(0xFFD32F2F)), listOf(Color(0xFFFF8A80), Color(0xFFFF5252))),
    CardTheme(Icons.Filled.School, listOf(Color(0xFF448AFF), Color(0xFF303F9F)), listOf(Color(0xFF82B1FF), Color(0xFF448AFF))),
    CardTheme(Icons.Filled.Style, listOf(Color(0xFF69F0AE), Color(0xFF00C853)), listOf(Color(0xFFB9F6CA), Color(0xFF69F0AE))),
)

@Composable
fun ReviewsScreen(
    onReviewClick: (Long, String) -> Unit,
    onCreateClick: () -> Unit,
    viewModel: ReviewsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.highlightReviewId) {
        if (state.highlightReviewId != null) {
            delay(1800)
            viewModel.clearHighlight()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (state.isLoading) {
            Column {
                repeat(4) {
                    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                        Spacer(Modifier.height(80.dp))
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Text(
                        text = "My Reviewers",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }

                item {
                    Text(
                        text = "All your study materials in one place",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                item { Spacer(modifier = Modifier.height(4.dp)) }

                if (state.reviews.isEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(40.dp))
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Description,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No reviewers yet",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Upload a file or pick a module to get started",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            )
                        }
                    }
                } else {
                    items(state.reviews, key = { it.id }) { review ->
                        ReviewCard(
                            review = review,
                            isNew = review.id == state.highlightReviewId,
                            onClick = { onReviewClick(review.id, review.title) },
                            onDelete = { viewModel.requestDelete(review) },
                        )
                    }
                }
            }
        }

        state.deleteTarget?.let { target ->
            Dialog(onDismissRequest = { viewModel.cancelDelete() }) {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = null,
                            tint = CognifyColors.Error,
                            modifier = Modifier.size(48.dp),
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "Delete Reviewer",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Are you sure you want to delete \"${target.title}\"? This cannot be undone.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(24.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Card(
                                onClick = { viewModel.cancelDelete() },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                            ) {
                                Box(Modifier.fillMaxWidth().padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                    Text("Cancel", fontWeight = FontWeight.Medium)
                                }
                            }
                            Card(
                                onClick = { viewModel.confirmDelete() },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = CognifyColors.Error),
                            ) {
                                Box(Modifier.fillMaxWidth().padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                    Text("Delete", fontWeight = FontWeight.Bold, color = Color.White)
                                }
                            }
                        }
                    }
                }
            }
        }

        FloatingActionButton(
            onClick = onCreateClick,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
            containerColor = CognifyColors.ElectricViolet,
            shape = RoundedCornerShape(999.dp),
        ) {
            Icon(Icons.Filled.Add, contentDescription = "Create Reviewer", tint = Color.White)
        }
    }
}

@Composable
private fun ReviewCard(
    review: ReviewEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    isNew: Boolean = false,
) {
    val theme = cardThemes[(review.id % cardThemes.size).toInt().coerceAtLeast(0)]
    val difficultyColor = when (review.difficulty) {
        "easy" -> CognifyColors.Success
        "hard" -> CognifyColors.Error
        else -> CognifyColors.Gold
    }

    val translateY = remember { Animatable(if (isNew) -160f else 0f) }
    val scale = remember { Animatable(if (isNew) 0.94f else 1f) }
    var highlight by remember { mutableStateOf(isNew) }
    val borderColor by animateColorAsState(
        targetValue = if (highlight) CognifyColors.ElectricViolet else Color.Transparent,
        animationSpec = tween(durationMillis = 900),
        label = "newReviewBorder",
    )
    val containerColor by animateColorAsState(
        targetValue = if (highlight) CognifyColors.ElectricViolet.copy(alpha = 0.12f)
        else MaterialTheme.colorScheme.surface,
        animationSpec = tween(durationMillis = 900),
        label = "newReviewContainer",
    )

    LaunchedEffect(isNew) {
        if (isNew) {
            translateY.animateTo(0f, spring(dampingRatio = 0.75f, stiffness = 350f))
            scale.animateTo(1f, spring(dampingRatio = 0.6f, stiffness = 450f))
            delay(700)
            highlight = false
        }
    }

    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer {
                translationY = translateY.value
                scaleX = scale.value
                scaleY = scale.value
            },
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(2.dp, borderColor),
        colors = CardDefaults.cardColors(
            containerColor = containerColor,
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .drawBehind {
                        val w = this.size.width
                        val h = this.size.height
                        drawCircle(theme.blobColors[0].copy(alpha = 0.35f), w * 0.45f, Offset(w * 0.7f, h * 0.3f))
                        drawCircle(theme.blobColors[1].copy(alpha = 0.25f), w * 0.35f, Offset(w * 0.2f, h * 0.8f))
                        drawCircle(theme.blobColors[0].copy(alpha = 0.15f), w * 0.5f, Offset(w * 0.5f, h * 0.5f))
                        drawRect(brush = Brush.horizontalGradient(theme.gradient), size = this.size)
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    theme.icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(28.dp),
                )
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = review.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (highlight) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .drawBehind {
                                    drawRect(
                                        brush = Brush.horizontalGradient(theme.gradient),
                                        size = this.size,
                                    )
                                }
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        ) {
                            Text(
                                text = "NEW",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = when (review.sourceType) {
                            "ai_generated" -> "AI Generated"
                            "upload" -> "Upload"
                            "module" -> "From Module"
                            else -> review.sourceType.replace("_", " ")
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "·",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = review.difficulty.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.bodySmall,
                        color = difficultyColor,
                    )
                }
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                )
            }
            Icon(
                Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            )
        }
    }
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true, showSystemUi = true)
@Composable
private fun ReviewsScreenPreview() {
    com.instructai.cognify.ui.theme.CognifyTheme {
        ReviewsScreen(onReviewClick = { _, _ -> }, onCreateClick = {})
    }
}
