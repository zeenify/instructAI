package com.instructai.cognify.ui.sets

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Style
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.CognifyGradients

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SetPickerScreen(
    reviewId: Long,
    type: String,
    reviewTitle: String = "",
    onBack: () -> Unit,
    onStartSet: (Long?) -> Unit,
    viewModel: SetPickerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var pendingDelete by remember { mutableStateOf<Long?>(null) }

    LaunchedEffect(reviewId, type) {
        viewModel.start(reviewId, type)
    }

    val icon = when (type) {
        "practice" -> Icons.Filled.QuestionAnswer
        else -> Icons.Filled.Style
    }
    val gradient = when (type) {
        "practice" -> CognifyGradients.gold
        else -> CognifyGradients.primary
    }
    val title = when (type) {
        "practice" -> "Practice Sets"
        else -> "Flashcard Sets"
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
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
                .padding(horizontal = 20.dp),
        ) {
            Text(
                text = reviewTitle.ifBlank { "Your reviewer" },
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Pick a set to study",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(16.dp))

            if (state.error != null && !state.isGenerating && !state.showGenerateSheet) {
                Text(
                    text = state.error!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(state.sets, key = { it.id ?: 0L }) { set ->
                    SetCard(
                        set = set,
                        icon = icon,
                        gradient = gradient,
                        deletable = set.id != null && state.sets.size > 1 && !state.isGenerating,
                        onClick = { onStartSet(set.id) },
                        onDelete = { pendingDelete = set.id },
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = { viewModel.openGenerateSheet() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = CognifyColors.ElectricViolet,
                    disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) {
                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(22.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Generate New Set", fontWeight = FontWeight.SemiBold)
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    val options = state.generationOptions
    if (state.showGenerateSheet && options != null) {
        NewSetSheet(
            type = type,
            reviewTitle = reviewTitle.ifBlank { "Your reviewer" },
            sourceText = state.sourceText,
            options = options,
            state = state,
            onOptions = { viewModel.updateOptions(it) },
            onGenerate = { viewModel.generateNewSet(options) },
            onDismiss = { viewModel.closeGenerateSheet() },
        )
    }

    val deleteTarget = pendingDelete?.let { id -> state.sets.find { it.id == id } }
    if (deleteTarget != null) {
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Delete ${deleteTarget.name}?") },
            text = { Text("This set and its ${deleteTarget.itemCount} items will be removed. This cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteSet(deleteTarget.id!!)
                        pendingDelete = null
                    },
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewSetSheet(
    type: String,
    reviewTitle: String,
    sourceText: String,
    options: GenerationOptions,
    state: SetPickerUiState,
    onOptions: ((GenerationOptions) -> GenerationOptions) -> Unit,
    onGenerate: () -> Unit,
    onDismiss: () -> Unit,
) {
    val isPractice = type == "practice"
    val maxCount = if (isPractice) 20 else 30
    val unit = if (isPractice) "questions" else "cards"

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        dragHandle = null,
    ) {
        if (state.isGenerating) {
            // Compact, content-fitted view — no fillMaxHeight (a scrollable
            // or weight-based stretch inside a bottom sheet looks broken).
            LiveGenerationSection(
                state = state,
                totalCount = options.count,
                unit = unit,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(top = 22.dp, bottom = 24.dp),
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(top = 22.dp, bottom = 28.dp),
            ) {
                Text(
                    text = "New ${if (isPractice) "Practice" else "Flashcard"} Set",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "From \"$reviewTitle\"",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Spacer(modifier = Modifier.height(18.dp))

                OptionsSection(
                    options = options,
                    sourceText = sourceText,
                    isPractice = isPractice,
                    maxCount = maxCount,
                    unit = unit,
                    onOptions = onOptions,
                )

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = onGenerate,
                    enabled = sourceText.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CognifyColors.ElectricViolet,
                        disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(22.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Generate ${options.count} $unit",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        if (state.error != null && !state.isGenerating) {
            Text(
                text = state.error!!,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
            )
        }
    }
}

@Composable
private fun OptionsSection(
    options: GenerationOptions,
    sourceText: String,
    isPractice: Boolean,
    maxCount: Int,
    unit: String,
    onOptions: ((GenerationOptions) -> GenerationOptions) -> Unit,
) {
    // --- Count ---
    Text(
        text = "How many",
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = CognifyColors.ElectricViolet,
    )
    Spacer(modifier = Modifier.height(6.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        OutlinedIconButton(
            onClick = { onOptions { it.copy(count = (it.count - 1).coerceAtLeast(1)) } },
            modifier = Modifier.size(40.dp),
            shape = RoundedCornerShape(12.dp),
        ) {
            Icon(Icons.Filled.Remove, contentDescription = "Fewer")
        }
        Text(
            text = "${options.count}",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        OutlinedIconButton(
            onClick = { onOptions { it.copy(count = (it.count + 1).coerceAtMost(maxCount)) } },
            modifier = Modifier.size(40.dp),
            shape = RoundedCornerShape(12.dp),
        ) {
            Icon(Icons.Filled.Add, contentDescription = "More")
        }
    }
    Slider(
        value = options.count.toFloat(),
        onValueChange = { v -> onOptions { o -> o.copy(count = v.toInt().coerceIn(1, maxCount)) } },
        valueRange = 1f..maxCount.toFloat(),
        colors = androidx.compose.material3.SliderDefaults.colors(
            thumbColor = CognifyColors.ElectricViolet,
            activeTrackColor = CognifyColors.ElectricViolet,
            inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    )

    Spacer(modifier = Modifier.height(10.dp))

    // --- Difficulty ---
    Text(
        text = "Difficulty",
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = CognifyColors.ElectricViolet,
    )
    Spacer(modifier = Modifier.height(6.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("easy", "medium", "hard").forEach { level ->
            FilterChip(
                selected = options.difficulty == level,
                onClick = { onOptions { o -> o.copy(difficulty = level) } },
                label = {
                    Text(
                        text = level.replaceFirstChar { c -> c.uppercase() },
                        fontWeight = if (options.difficulty == level) FontWeight.Bold else FontWeight.Normal,
                    )
                },
                colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CognifyColors.ElectricViolet.copy(alpha = 0.18f),
                    selectedLabelColor = CognifyColors.ElectricViolet,
                ),
            )
        }
    }

    Spacer(modifier = Modifier.height(14.dp))

    // --- Extra prompt ---
    Text(
        text = "Additional prompt",
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = CognifyColors.ElectricViolet,
    )
    Spacer(modifier = Modifier.height(6.dp))
    OutlinedTextField(
        value = options.extraPrompt,
        onValueChange = { text -> onOptions { o -> o.copy(extraPrompt = text) } },
        modifier = Modifier.fillMaxWidth(),
        placeholder = {
            Text(
                text = if (isPractice) "Optional — e.g. exam-style, focus on definitions"
                else "Optional — e.g. focus on key terms, one-word answers",
                style = MaterialTheme.typography.bodySmall,
            )
        },
        minLines = 2,
        maxLines = 4,
        shape = RoundedCornerShape(12.dp),
    )

    Spacer(modifier = Modifier.height(14.dp))

    // --- Avoid existing items ---
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Skip existing items",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = "Don't repeat what's already in other sets",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(
            checked = options.avoidUsed,
            onCheckedChange = { checked -> onOptions { o -> o.copy(avoidUsed = checked) } },
            colors = SwitchDefaults.colors(
                checkedThumbColor = CognifyColors.Gold,
                checkedTrackColor = CognifyColors.ElectricViolet.copy(alpha = 0.4f),
            ),
        )
    }

    Spacer(modifier = Modifier.height(14.dp))

    // --- Collapsible source context ---
    var contextExpanded by remember { mutableStateOf(false) }
    Card(
        onClick = { contextExpanded = !contextExpanded },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        ),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Source context",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${sourceText.length} chars",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.width(6.dp))
                Icon(
                    if (contextExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = if (contextExpanded) "Hide source" else "Show source",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp),
                )
            }
            AnimatedVisibility(visible = contextExpanded) {
                Text(
                    text = sourceText.ifBlank { "No source content" },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .padding(top = 10.dp)
                        .heightIn(max = 220.dp)
                        .verticalScroll(rememberScrollState()),
                )
            }
        }
    }
}

@Composable
private fun LiveGenerationSection(
    state: SetPickerUiState,
    totalCount: Int,
    unit: String,
    modifier: Modifier = Modifier,
) {
    val progress = if (totalCount > 0) state.liveItems.size / totalCount.toFloat() else 0f

    Column(modifier = modifier.fillMaxWidth()) {
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(10.dp)
                .clip(RoundedCornerShape(5.dp)),
            color = CognifyColors.ElectricViolet,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
            gapSize = 0.dp,
            drawStopIndicator = {},
        )
        Spacer(modifier = Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = if (state.liveItems.isEmpty()) "Generating your set"
                else "${state.liveItems.size} of $totalCount $unit",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "${(progress * 100).toInt()}%",
                style = MaterialTheme.typography.labelLarge,
                color = CognifyColors.ElectricViolet,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (state.liveItems.isEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = CognifyColors.ElectricViolet,
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "Warming up the AI…",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.heightIn(max = 400.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                itemsIndexed(state.liveItems, key = { index, _ -> index }) { index, item ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .animateItem(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                        ),
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(CognifyColors.ElectricViolet.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = "${index + 1}",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = CognifyColors.ElectricViolet,
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.front,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (item.back.isNotBlank()) {
                                    Spacer(modifier = Modifier.height(3.dp))
                                    Text(
                                        text = item.back,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))
        Surface(
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
            modifier = Modifier.align(Alignment.CenterHorizontally),
        ) {
            Text(
                text = "Keep this screen open — new $unit appear as they're generated",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
            )
        }
    }
}

@Composable
private fun SetCard(
    set: ReviewSetInfo,
    icon: ImageVector,
    gradient: Brush,
    deletable: Boolean,
    onClick: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(gradient),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = set.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "${set.itemCount} ${if (set.itemCount == 1) "item" else "items"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (deletable) {
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Delete ${set.name}",
                        tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                        modifier = Modifier.size(20.dp),
                    )
                }
            }

            Icon(
                Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            )
        }
    }
}
