package com.instructai.cognify.ui.stats

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Style
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.data.local.entity.CompletedSessionEntity
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.LocalIsDarkTheme
import java.time.DayOfWeek
import java.time.LocalDate

/*
 * Statistics — Apple grouped style: accent streak hero, 2x2 totals grid,
 * weekly bars, 28-day activity grid, recent sessions.
 */

@Composable
fun StatsScreen(
    onReviewClick: (Long, String) -> Unit = { _, _ -> },
    viewModel: StatsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val isDark = LocalIsDarkTheme.current
    val accent = MaterialTheme.colorScheme.primary

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
    ) {
        Spacer(modifier = Modifier.height(14.dp))

        Text(
            text = "Statistics",
            style = MaterialTheme.typography.displayMedium,
        )

        if (state.isLoading) {
            Spacer(modifier = Modifier.height(20.dp))
            repeat(3) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(110.dp)
                        .padding(vertical = 6.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                )
            }
            Spacer(modifier = Modifier.height(40.dp))
            return@Column
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Streak hero
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            colors = CardDefaults.cardColors(
                containerColor = accent.copy(alpha = 0.13f),
            ),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (state.studyStreak > 0) "You're on a streak" else "Start your streak",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = "${state.studyStreak} ${if (state.studyStreak == 1) "day" else "days"}",
                        style = MaterialTheme.typography.displayLarge,
                        color = accent,
                    )
                    if (state.bestStreak > state.studyStreak) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Best: ${state.bestStreak} days",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(accent.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Whatshot,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(26.dp),
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 2x2 totals grid
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TotalCell(
                icon = Icons.Filled.Style,
                tint = accent,
                value = "${state.totalFlashcards}",
                label = "Cards reviewed",
                modifier = Modifier.weight(1f),
            )
            TotalCell(
                icon = Icons.Filled.Quiz,
                tint = CognifyColors.Semantics.info(isDark),
                value = "${state.totalQuestions}",
                label = "Questions answered",
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TotalCell(
                icon = Icons.Filled.Description,
                tint = CognifyColors.Semantics.success(isDark),
                value = "${state.totalReviews}",
                label = "Reviewers created",
                modifier = Modifier.weight(1f),
            )
            TotalCell(
                icon = Icons.Filled.TrendingUp,
                tint = CognifyColors.Semantics.warning(isDark),
                value = state.avgScore?.let { "${(it * 100).toInt()}%" } ?: "—",
                label = "Avg. practice score",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(modifier = Modifier.height(22.dp))

        SectionHeader("This Week")

        Spacer(modifier = Modifier.height(10.dp))

        GroupedCard {
            WeekBarChart(
                weekly = state.weeklyActivity,
                accent = accent,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
            )
        }

        Spacer(modifier = Modifier.height(22.dp))

        SectionHeader("Activity · Last 28 Days")

        Spacer(modifier = Modifier.height(10.dp))

        GroupedCard {
            ActivityGrid(
                days = state.dailyActivity,
                accent = accent,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
            )
        }

        if (state.recentSessions.isNotEmpty()) {
            Spacer(modifier = Modifier.height(22.dp))

            SectionHeader("Recent Sessions")

            Spacer(modifier = Modifier.height(10.dp))

            GroupedCard {
                Column {
                    state.recentSessions.forEachIndexed { index, session ->
                        RecentSessionRow(
                            session = session,
                            isDark = isDark,
                            onClick = { onReviewClick(session.reviewId, session.title) },
                        )
                        if (index != state.recentSessions.lastIndex) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(0.75.dp)
                                    .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
                            )
                        }
                    }
                }
            }
        } else if (state.totalSessions == 0 && state.totalReviews == 0) {
            Spacer(modifier = Modifier.height(22.dp))
            GroupedCard {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(accent.copy(alpha = 0.13f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Style,
                            contentDescription = null,
                            tint = accent,
                            modifier = Modifier.size(26.dp),
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "No study activity yet",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Finish a flashcard deck or a practice test and your stats will appear here.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp),
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(36.dp))
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/** White (light) / elevated (dark) grouped container — the iOS inset-list card. */
@Composable
private fun GroupedCard(content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        content()
    }
}

@Composable
private fun TotalCell(
    icon: ImageVector,
    tint: Color,
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Icon(
                icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(20.dp),
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
            )
            Spacer(modifier = Modifier.height(1.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun WeekBarChart(
    weekly: Map<DayOfWeek, Int>,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val days = listOf(
        "M" to DayOfWeek.MONDAY,
        "T" to DayOfWeek.TUESDAY,
        "W" to DayOfWeek.WEDNESDAY,
        "T" to DayOfWeek.THURSDAY,
        "F" to DayOfWeek.FRIDAY,
        "S" to DayOfWeek.SATURDAY,
        "S" to DayOfWeek.SUNDAY,
    )
    val maxValue = (weekly.values.maxOrNull() ?: 0).coerceAtLeast(1)
    val chartHeight = 96.dp

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        days.forEach { (letter, day) ->
            val count = weekly[day] ?: 0
            val barFraction = if (count == 0) 0f else (count.toFloat() / maxValue).coerceIn(0.15f, 1f)
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = if (count > 0) "$count" else "",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(5.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(chartHeight),
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height((chartHeight * barFraction).coerceAtLeast(6.dp))
                            .clip(RoundedCornerShape(5.dp))
                            .background(if (count > 0) accent else MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
                Spacer(modifier = Modifier.height(7.dp))
                Text(
                    text = letter,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ActivityGrid(
    days: List<com.instructai.cognify.data.repository.DailyActivity>,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    if (days.isEmpty()) {
        Box(
            modifier = modifier.height(40.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Not enough data yet",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }
    // 7 columns (weeks) x up to 4 rows; trailing filler keeps spacing even.
    val placeholder = List((7 - days.size % 7) % 7) { null }
    val cells: List<com.instructai.cognify.data.repository.DailyActivity?> = days + placeholder

    Column(modifier = modifier) {
        cells.chunked(7).forEach { week ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                week.forEach { day ->
                    val level = when {
                        day == null -> -1
                        day.total == 0 -> 0
                        day.total < 4 -> 1
                        day.total < 10 -> 2
                        else -> 3
                    }
                    val color = when (level) {
                        -1 -> Color.Transparent
                        0 -> MaterialTheme.colorScheme.surfaceVariant
                        1 -> accent.copy(alpha = 0.35f)
                        2 -> accent.copy(alpha = 0.65f)
                        else -> accent
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(30.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(color),
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
        }
        Spacer(modifier = Modifier.height(2.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Less",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            listOf(
                MaterialTheme.colorScheme.surfaceVariant,
                accent.copy(alpha = 0.35f),
                accent.copy(alpha = 0.65f),
                accent,
            ).forEach { c ->
                Spacer(modifier = Modifier.width(3.dp))
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(c),
                )
            }
            Spacer(modifier = Modifier.width(3.dp))
            Text(
                text = "More",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun RecentSessionRow(
    session: com.instructai.cognify.data.local.dao.RecentSessionInfo,
    isDark: Boolean,
    onClick: () -> Unit,
) {
    val isFlashcards = session.type == CompletedSessionEntity.TYPE_FLASHCARD
    val tint = CognifyColors.chipTint(if (isFlashcards) 0 else 3, isDark)
    val day = LocalDate.ofEpochDay(session.dateEpochDay)
    val today = LocalDate.now()
    val dayLabel = when (day) {
        today -> "Today"
        today.minusDays(1) -> "Yesterday"
        else -> "${day.month.name.lowercase().replaceFirstChar { it.uppercase() }} ${day.dayOfMonth}"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(11.dp))
                .background(tint.soft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (isFlashcards) Icons.Filled.Style else Icons.Filled.Quiz,
                contentDescription = null,
                tint = tint.fg,
                modifier = Modifier.size(19.dp),
            )
        }
        Spacer(modifier = Modifier.width(13.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = session.title,
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(1.dp))
            Text(
                text = if (isFlashcards) "Flashcards · $dayLabel" else "Practice test · $dayLabel",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Icon(
            Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f),
            modifier = Modifier.size(16.dp),
        )
    }
}

