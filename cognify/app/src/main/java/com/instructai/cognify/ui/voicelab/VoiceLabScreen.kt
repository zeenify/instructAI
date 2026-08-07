package com.instructai.cognify.ui.voicelab

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.instructai.cognify.data.tts.GenResult
import com.instructai.cognify.data.tts.VoiceLabVoice
import com.instructai.cognify.ui.components.CognifyGradientButton
import com.instructai.cognify.ui.components.CognifyTopBar
import java.io.File

private const val RESULT_ITEM_INDEX = 4

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun VoiceLabScreen(
    onBack: () -> Unit,
    viewModel: VoiceLabViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    DisposableEffect(Unit) {
        onDispose {
            viewModel.stopPlayback()
        }
    }

    LaunchedEffect(state.lastResult) {
        if (state.lastResult != null) {
            listState.animateScrollToItem(RESULT_ITEM_INDEX)
        }
    }

    Scaffold(
        topBar = { CognifyTopBar(title = "Voice Lab (Phase 0)", onBack = onBack) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item { ModelStatusCard(state.modelStatus, onRefresh = { viewModel.refreshModelStatus() }) }

            item {
                Text("Voice", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    state.voices.forEach { voice ->
                        FilterChip(
                            selected = state.selectedVoiceId == voice.id,
                            onClick = { viewModel.selectVoice(voice.id) },
                            label = { Text(voice.label) },
                        )
                    }
                }
            }

            item {
                Text("Script", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(
                    value = state.text,
                    onValueChange = { viewModel.setText(it) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 6,
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf("Flashcard", "Praise", "New card", "Encourage").forEachIndexed { i, label ->
                        androidx.compose.material3.TextButton(
                            onClick = { viewModel.usePreset(i) },
                            modifier = Modifier.padding(0.dp),
                        ) { Text(label) }
                    }
                }
            }

            item {
                CognifyGradientButton(
                    text = if (state.isGenerating) "Generating..." else "Generate & play",
                    onClick = { viewModel.generate() },
                    enabled = state.text.isNotBlank() && !state.isGenerating,
                )
            }

            if (state.error != null) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                        ),
                    ) {
                        Text(
                            state.error!!,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                }
            }

            state.lastResult?.let { result ->
                item { ResultCard(result, isPlaying = state.isPlaying, onTogglePlay = { viewModel.togglePlay() }) }
            }

            if (state.history.size > 1) {
                item {
                    Text("History", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                }
                items(state.history.drop(1)) { result ->
                    ResultCard(result, isPlaying = false, onTogglePlay = { viewModel.playPath(result.wavPath) }, compact = true)
                }
            }
        }
    }
}

@Composable
private fun ModelStatusCard(status: List<Pair<String, Long>>, onRefresh: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Model files", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Filled.Refresh, contentDescription = "Refresh", modifier = Modifier.width(18.dp))
                }
            }
            if (status.isEmpty()) {
                Text("No models dir yet", style = MaterialTheme.typography.bodySmall)
            } else {
                status.forEach { (path, size) ->
                    val name = File(path).name
                    val ok = size > 0L
                    Text(
                        text = "${if (ok) "OK " else "MISS"} $name${if (ok) " (${size / 1024 / 1024} MB)" else ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (ok) MaterialTheme.colorScheme.onSurfaceVariant
                        else MaterialTheme.colorScheme.error,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

@Composable
private fun ResultCard(
    result: GenResult,
    isPlaying: Boolean,
    onTogglePlay: () -> Unit,
    compact: Boolean = false,
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("${result.voiceLabel}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(
                        "\"${result.textSnippet}...\"",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                }
                IconButton(onClick = onTogglePlay, enabled = result.wavPath != null) {
                    Icon(
                        if (isPlaying && !compact) Icons.Filled.Stop else Icons.Filled.PlayArrow,
                        contentDescription = "Play",
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            if (!compact) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Metric("TTS", result.engineLabel)
                    Metric("RTF", "%.2f".format(result.realTimeFactor))
                    Metric("Audio", "${result.audioDurationMs / 1000}.${(result.audioDurationMs % 1000) / 100}s")
                    Metric("Load", "${result.loadMs}ms")
                }
            }
        }
    }
}

@Composable
private fun Metric(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
