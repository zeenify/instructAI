package com.instructai.cognify.ui.reviews

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.runtime.collectAsState
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.LocalIsDarkTheme
import kotlinx.coroutines.delay

/*
 * Reviewers — Apple grouped list: tinted icon chips, hairline dividers inside
 * one inset card per row, NEW highlight on freshly created reviewers.
 */

private fun reviewSourceLabel(source: String): String = when (source) {
    "ai_generated" -> "AI Generated"
    "upload" -> "Upload"
    "module" -> "From Module"
    else -> source.replace('_', ' ')
}

@Composable
fun ReviewsScreen(
    onReviewClick: (Long, String) -> Unit,
    onCreateClick: () -> Unit,
    viewModel: ReviewsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val isDark = LocalIsDarkTheme.current

    LaunchedEffect(state.highlightReviewId) {
        if (state.highlightReviewId != null) {
            delay(1800)
            viewModel.clearHighlight()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        if (state.isLoading) {
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
                Box(
                    modifier = Modifier
                        .width(170.dp)
                        .height(34.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                )
                Spacer(Modifier.height(16.dp))
                repeat(4) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp)
                            .height(78.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                item {
                    Column {
                        Text(
                            text = "Reviewers",
                            style = MaterialTheme.typography.displayMedium,
                        )
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = "${state.reviews.size} ${if (state.reviews.size == 1) "reviewer" else "reviewers"} · tap to study",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                if (state.reviews.isEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(60.dp))
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.13f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Filled.Description,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(28.dp),
                                )
                            }
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = "No reviewers yet",
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Upload a file or pick a class module to get started",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                } else {
                    items(state.reviews, key = { it.id }) { review ->
                        ReviewCard(
                            review = review,
                            isDark = isDark,
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
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                    Column(
                        modifier = Modifier.padding(26.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(52.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.errorContainer),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(24.dp),
                            )
                        }
                        Spacer(Modifier.height(14.dp))
                        Text("Delete Reviewer?", style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "\"${target.title}\" and its study progress cannot be recovered.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(22.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Card(
                                onClick = { viewModel.cancelDelete() },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                                ),
                            ) {
                                Box(Modifier.fillMaxWidth().padding(vertical = 13.dp), contentAlignment = Alignment.Center) {
                                    Text(
                                        "Cancel",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.onSurface,
                                    )
                                }
                            }
                            Card(
                                onClick = { viewModel.confirmDelete() },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.error,
                                ),
                            ) {
                                Box(Modifier.fillMaxWidth().padding(vertical = 13.dp), contentAlignment = Alignment.Center) {
                                    Text(
                                        "Delete",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.onError,
                                    )
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
                .padding(20.dp),
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            shape = RoundedCornerShape(20.dp),
        ) {
            Icon(Icons.Filled.Add, contentDescription = "Create Reviewer")
        }
    }
}

@Composable
private fun ReviewCard(
    review: ReviewEntity,
    isDark: Boolean,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    isNew: Boolean = false,
) {
    val tint = CognifyColors.chipTint((review.id % 6).toInt().coerceAtLeast(0), isDark)

    val translateY = remember { Animatable(if (isNew) -160f else 0f) }
    val scale = remember { Animatable(if (isNew) 0.94f else 1f) }
    var highlight by remember { mutableStateOf(isNew) }
    val borderColor by animateColorAsState(
        targetValue = if (highlight) MaterialTheme.colorScheme.primary else Color.Transparent,
        animationSpec = tween(durationMillis = 900),
        label = "newReviewBorder",
    )
    val containerColor by animateColorAsState(
        targetValue = if (highlight) MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
        else MaterialTheme.colorScheme.surface,
        animationSpec = tween(durationMillis = 900),
        label = "newReviewContainer",
    )

    androidx.compose.runtime.LaunchedEffect(isNew) {
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
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = if (highlight) BorderStroke(1.5.dp, borderColor) else null,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(15.dp))
                    .background(tint.soft),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Description,
                    contentDescription = null,
                    tint = tint.fg,
                    modifier = Modifier.size(24.dp),
                )
            }
            Spacer(modifier = Modifier.width(13.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = review.title,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (highlight) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(7.dp))
                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f))
                                .padding(horizontal = 7.dp, vertical = 2.dp),
                        ) {
                            Text(
                                text = "NEW",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = "${reviewSourceLabel(review.sourceType)} · ${review.difficulty.replaceFirstChar { it.uppercase() }}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(modifier = Modifier.width(6.dp))
            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(34.dp),
            ) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.55f),
                    modifier = Modifier.size(19.dp),
                )
            }
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                modifier = Modifier.size(16.dp),
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
