package com.instructai.cognify.ui.home

import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Style
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.ui.components.CognifyGradientButton
import com.instructai.cognify.ui.components.ShimmerHomeSkeleton
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.CognifyGradients

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
fun HomeScreen(
    onReviewClick: (Long, String) -> Unit,
    onCreateReview: () -> Unit,
    onNavigateToSettings: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<ReviewEntity?>(null) }

    if (showDeleteDialog && deleteTarget != null) {
        Dialog(onDismissRequest = { showDeleteDialog = false }) {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            ) {
                Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFFF5252).copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = null,
                            tint = Color(0xFFFF5252),
                            modifier = Modifier.size(28.dp),
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Delete Review",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Are you sure you want to delete \"${deleteTarget!!.title}\"?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Button(
                            onClick = { showDeleteDialog = false },
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            ),
                        ) {
                            Text("Cancel", fontWeight = FontWeight.SemiBold)
                        }
                        Button(
                            onClick = {
                                deleteTarget?.let { viewModel.deleteReview(it.id) }
                                showDeleteDialog = false
                                deleteTarget = null
                            },
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                        ) {
                            Text("Delete", fontWeight = FontWeight.SemiBold, color = Color.White)
                        }
                    }
                }
            }
        }
    }

    if (state.isLoading) {
        ShimmerHomeSkeleton()
        return
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 80.dp),
        ) {
            // Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            text = "Welcome back!",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = state.userName,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(
                            Icons.Filled.Settings,
                            contentDescription = "Settings",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Streak + Stats row
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    PremiumStatCard(
                        title = "Due Today",
                        value = "${state.dueCount}",
                        icon = Icons.Filled.Bolt,
                        gradient = CognifyGradients.primary,
                        modifier = Modifier.weight(1f),
                    )
                    PremiumStatCard(
                        title = "Day Streak",
                        value = "${state.studyStats.currentStreak}",
                        icon = Icons.Filled.Whatshot,
                        gradient = CognifyGradients.gold,
                        modifier = Modifier.weight(1f),
                    )
                    PremiumStatCard(
                        title = "Reviewers",
                        value = "${state.studyStats.reviewsCreated}",
                        icon = Icons.Filled.Description,
                        gradient = CognifyGradients.success,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // Quick Study card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.Transparent,
                    ),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                brush = Brush.horizontalGradient(
                                    listOf(
                                        CognifyColors.ElectricViolet.copy(alpha = 0.15f),
                                        CognifyColors.Midnight,
                                    )
                                ),
                                shape = RoundedCornerShape(16.dp),
                            )
                            .padding(20.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(CognifyGradients.primary),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Filled.School,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp),
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Quick Study",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "Create a reviewer from your class materials or upload a file",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }

            // Recent Reviewers header
            if (state.recentReviews.isNotEmpty()) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Recent Reviewers",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }

            // Recent reviewers horizontal scroll
            if (state.recentReviews.isNotEmpty()) {
                item {
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(state.recentReviews) { review ->
                            ReviewCarouselCard(
                                review = review,
                                onClick = { onReviewClick(review.id, review.title) },
                                onLongClick = {
                                    deleteTarget = review
                                    showDeleteDialog = true
                                },
                            )
                        }
                    }
                }
            }

            // Empty state
            if (state.recentReviews.isEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(24.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "Ready to study?",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Upload a file or pick a module to create your first reviewer.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                        CognifyGradientButton(
                            text = "Create Your First Reviewer",
                            onClick = onCreateReview,
                            gradient = CognifyGradients.primary,
                        )
                    }
                }
            }
        }

        // FAB
        FloatingActionButton(
            onClick = onCreateReview,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp),
            containerColor = CognifyColors.ElectricViolet,
            shape = RoundedCornerShape(999.dp),
        ) {
            Icon(Icons.Filled.Add, contentDescription = "Create Review", tint = Color.White)
        }
    }
}

@Composable
private fun PremiumStatCard(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    gradient: Brush,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(gradient),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp),
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ReviewCarouselCard(
    review: ReviewEntity,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
) {
    val theme = cardThemes[(review.id % cardThemes.size).toInt().coerceAtLeast(0)]
    val transition = rememberInfiniteTransition(label = "blobs_${review.id}")
    val off1x by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(7000, easing = androidx.compose.animation.core.EaseInOutCubic)), label = "o1x")
    val off1y by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = androidx.compose.animation.core.EaseInOutCubic)), label = "o1y")
    val off2x by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(11000, easing = androidx.compose.animation.core.EaseInOutCubic)), label = "o2x")
    val off2y by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(8000, easing = androidx.compose.animation.core.EaseInOutCubic)), label = "o2y")
    val off3x by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(10000, easing = androidx.compose.animation.core.EaseInOutCubic)), label = "o3x")
    val off3y by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(12000, easing = androidx.compose.animation.core.EaseInOutCubic)), label = "o3y")

    val wobble = { v: Float, range: Float -> (v - 0.5f) * 2f * range }

    Card(
        modifier = Modifier
            .width(220.dp)
            .height(140.dp)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick,
            ),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.Transparent,
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .drawBehind {
                    val w = this.size.width
                    val h = this.size.height
                    drawRect(brush = Brush.horizontalGradient(theme.gradient, startX = 0f, endX = w), size = this.size)
                    drawCircle(theme.blobColors[0].copy(alpha = 0.25f), w * 0.7f, Offset(w * 0.75f + wobble(off1x, w * 0.06f), h * 0.15f + wobble(off1y, h * 0.05f)))
                    drawCircle(theme.blobColors[1].copy(alpha = 0.2f), w * 0.5f, Offset(w * 0.15f + wobble(off2x, w * 0.05f), h * 0.85f + wobble(off2y, h * 0.04f)))
                    drawCircle(theme.blobColors[0].copy(alpha = 0.12f), w * 0.45f, Offset(w * 0.5f + wobble(off3x, w * 0.07f), h * 0.45f + wobble(off3y, h * 0.06f)))
                }
                .padding(16.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Icon(
                    theme.icon,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.9f),
                    modifier = Modifier.size(22.dp),
                )
                Column {
                    Text(
                        text = review.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = when (review.difficulty) {
                            "easy" -> "Easy"
                            "hard" -> "Hard"
                            else -> "Medium"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.7f),
                    )
                }
            }
        }
    }
}
