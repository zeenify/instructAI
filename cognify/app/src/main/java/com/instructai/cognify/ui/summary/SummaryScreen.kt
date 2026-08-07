package com.instructai.cognify.ui.summary

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.audio.PlayerState
import com.instructai.cognify.data.local.entity.TtsClipEntity
import com.instructai.cognify.data.local.entity.TtsStatus
import com.instructai.cognify.data.tts.TtsJson
import com.instructai.cognify.ui.audio.VocalAvatar
import com.instructai.cognify.ui.audio.VoiceSelectorDialog
import com.instructai.cognify.ui.audio.voiceColor
import com.instructai.cognify.ui.audio.voiceImageFor
import com.instructai.cognify.ui.components.ShimmerCard
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.CognifyGradients

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SummaryScreen(
    reviewId: Long,
    onBack: () -> Unit,
    viewModel: SummaryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val player by viewModel.playerState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val showVoiceSelector = remember { mutableStateOf(false) }

    val localVoices = listOf(
        VocalAvatar("kokoro-local-female", "Kokoro Female", "", painting = Color(0xFFE91E63)),
        VocalAvatar("kokoro-local-male", "Kokoro Male", "", painting = Color(0xFF2196F3)),
        VocalAvatar("cogni-placeholder", "Cogni", "", painting = Color(0xFF7C4DFF)),
    )
    val characterAvatars = state.voices.map { v ->
        VocalAvatar(
            id = v.id,
            name = v.name,
            subtitle = "",
            painting = voiceColor(v.id, v.name),
            imageRes = voiceImageFor(v.name),
        )
    }
    val allVoices = localVoices + characterAvatars
    val selectedAvatar = allVoices.firstOrNull { it.id == state.selectedVoiceId }
        ?: allVoices.firstOrNull { it.id == null }
        ?: localVoices.first()

    val playerActive = player.reviewId == reviewId

    LaunchedEffect(reviewId) {
        viewModel.loadContent(reviewId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Summary") },
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
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        if (state.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                Text("Loading summary...", style = MaterialTheme.typography.bodyLarge)
            }
            return@Scaffold
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
            ) {
                SegmentedTabs(
                    selected = state.tab,
                    onSelect = viewModel::selectTab,
                )

                Spacer(modifier = Modifier.height(12.dp))

                when (state.tab) {
                    SummaryTab.NOTES -> NotesTab(state.sections)
                    SummaryTab.READ_ALOUD -> ReadAloudTab(
                        state = state,
                        player = player,
                        playerActive = playerActive,
                        selectedAvatar = selectedAvatar,
                        onSelectVoice = { showVoiceSelector.value = true },
                        onGenerate = viewModel::generateTransform,
                        onPlayAt = { index -> viewModel.togglePlay(index) },
                        onSeek = viewModel::seekTo,
                    )
                }
            }

            AnimatedVisibility(
                visible = playerActive,
                modifier = Modifier.align(Alignment.BottomCenter),
                enter = slideInVertically(initialOffsetY = { it }),
                exit = slideOutVertically(targetOffsetY = { it }),
            ) {
                MiniPlayerPill(
                    state = player,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    selectedAvatar = selectedAvatar,
                    onToggle = { viewModel.togglePlay(0) },
                    onSpeed = { viewModel.setSpeed(nextSpeed(player.speed)) },
                    onSelectVoice = { showVoiceSelector.value = true },
                    onSeekTime = viewModel::seekToTime,
                    onClose = viewModel::stopPlayer,
                )
            }
        }
    }

    if (showVoiceSelector.value) {
        VoiceSelectorDialog(
            localVoices = localVoices,
            characterVoices = characterAvatars,
            selectedId = state.selectedVoiceId,
            onSelect = { id, _ ->
                viewModel.selectVoice(reviewId, id)
            },
            onDismiss = { showVoiceSelector.value = false },
        )
    }
}

// --- Tabs ---

@Composable
private fun SegmentedTabs(
    selected: SummaryTab,
    onSelect: (SummaryTab) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(4.dp),
    ) {
        SummaryTab.entries.forEach { tab ->
            val active = tab == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .then(
                        if (active) {
                            Modifier.background(CognifyGradients.primary)
                        } else {
                            Modifier.background(Color.Transparent)
                        }
                    )
                    .clickable { onSelect(tab) }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (tab == SummaryTab.NOTES) "Notes" else "Read Aloud",
                    color = if (active) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
    }
}

// --- Notes tab ---

@Composable
private fun NotesTab(sections: List<SummarySection>) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        if (sections.isEmpty()) {
            Text(
                text = "No summary available",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            sections.forEach { section ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = section.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Box(
                                modifier = Modifier
                                    .width(48.dp)
                                    .height(4.dp)
                                    .background(
                                        Brush.horizontalGradient(CognifyGradients.accentPair),
                                        RoundedCornerShape(2.dp)
                                    )
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        section.points.forEach { point ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.Top,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .background(CognifyColors.ElectricViolet, RoundedCornerShape(4.dp)),
                                )
                                Spacer(modifier = Modifier.width(14.dp))
                                Text(
                                    text = point,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- Read Aloud tab ---

@Composable
private fun ReadAloudTab(
    state: SummaryState,
    player: PlayerState,
    playerActive: Boolean,
    selectedAvatar: VocalAvatar,
    onSelectVoice: () -> Unit,
    onGenerate: () -> Unit,
    onPlayAt: (Int) -> Unit,
    onSeek: (Int) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        NarratorRow(selectedAvatar, onSelectVoice)

        Spacer(modifier = Modifier.height(14.dp))

        val transform = state.transform
        when {
            transform == null -> GenerateCta(selectedAvatar, onGenerate)

            transform.status == TtsStatus.GENERATING || transform.status == TtsStatus.QUEUED ->
                GeneratingState()

            transform.status == TtsStatus.ERROR -> ErrorState(selectedAvatar, onGenerate)

            else -> {
                val sentences = remember(transform) {
                    TtsJson.sentencesFromJson(transform.sentencesJson)
                        .ifEmpty { TtsJson.sentencesFromParagraphs(TtsJson.paragraphsFromJson(transform.paragraphsJson)) }
                }
                if (sentences.isEmpty()) {
                    ErrorState(selectedAvatar, onGenerate)
                } else {
                    ParagraphList(
                        sentences = sentences,
                        clips = state.clips,
                        player = player,
                        playerActive = playerActive,
                        onPlayAt = onPlayAt,
                        onSeek = onSeek,
                    )
                }
            }
        }
    }
}

@Composable
private fun NarratorRow(
    selectedAvatar: VocalAvatar,
    onSelectVoice: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
            .clickable { onSelectVoice() }
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(selectedAvatar.painting.copy(alpha = 0.55f), selectedAvatar.painting.copy(alpha = 0.2f))
                    )
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (selectedAvatar.imageRes != null) {
                Image(
                    painter = painterResource(selectedAvatar.imageRes),
                    contentDescription = selectedAvatar.name,
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Text(
                    text = selectedAvatar.name.take(1).uppercase(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                )
            }
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Narrator",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = selectedAvatar.name,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = "Change narrator",
            tint = CognifyColors.ElectricViolet,
        )
    }
}

@Composable
private fun GenerateCta(
    selectedAvatar: VocalAvatar,
    onGenerate: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            Brush.horizontalGradient(CognifyGradients.accentPair)
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            CognifyColors.ElectricViolet.copy(alpha = 0.12f),
                            CognifyColors.DeepNavy.copy(alpha = 0.08f)
                        )
                    ),
                    RoundedCornerShape(20.dp)
                )
                .padding(20.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(
                            Brush.verticalGradient(
                                listOf(selectedAvatar.painting.copy(alpha = 0.6f), selectedAvatar.painting.copy(alpha = 0.25f))
                            )
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (selectedAvatar.imageRes != null) {
                        Image(
                            painter = painterResource(selectedAvatar.imageRes),
                            contentDescription = selectedAvatar.name,
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(18.dp)),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Text(
                            text = selectedAvatar.name.take(1).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 28.sp,
                        )
                    }
                }
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = "Generate reading version",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "AI rewrites your study guide as flowing paragraphs, read aloud in ${selectedAvatar.name}'s voice.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onGenerate,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Transparent,
                        contentColor = Color.White,
                    ),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(CognifyGradients.primary, RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Generate",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "You can leave this screen — it continues in the background.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun GeneratingState() {
    Column(modifier = Modifier.fillMaxSize()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    strokeWidth = 3.dp,
                    color = CognifyColors.ElectricViolet,
                )
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = "Generating reading version...",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "You can keep browsing — this continues in the background.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
        Spacer(modifier = Modifier.height(14.dp))
        ShimmerCard()
        Spacer(modifier = Modifier.height(12.dp))
        ShimmerCard()
        Spacer(modifier = Modifier.height(12.dp))
        ShimmerCard()
    }
}

@Composable
private fun ErrorState(
    selectedAvatar: VocalAvatar,
    onRetry: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Generation failed",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Check your connection or Gemini API key, then try again.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(14.dp))
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = CognifyColors.ElectricViolet,
                    contentColor = Color.White,
                ),
            ) {
                Text("Retry", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ParagraphList(
    sentences: List<String>,
    clips: List<TtsClipEntity>,
    player: PlayerState,
    playerActive: Boolean,
    onPlayAt: (Int) -> Unit,
    onSeek: (Int) -> Unit,
) {
    val listState = rememberLazyListState()
    val currentIndex = player.currentIndex

    LaunchedEffect(currentIndex, playerActive) {
        if (playerActive && currentIndex >= 0 && currentIndex < sentences.size) {
            listState.animateScrollToItem(currentIndex)
        }
    }

    val readyCount = clips.count { it.status == TtsStatus.READY }
    val pending = clips.any { it.status == TtsStatus.GENERATING || it.status == TtsStatus.QUEUED } ||
        clips.size < sentences.size

    Column(modifier = Modifier.fillMaxSize()) {
        Button(
            onClick = {
                if (playerActive) {
                    onPlayAt(currentIndex.coerceAtLeast(0))
                } else {
                    onPlayAt(0)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent,
                contentColor = Color.White,
            ),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(CognifyGradients.primary, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (playerActive && player.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (playerActive && player.isPlaying) "Pause" else "Play all",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                }
            }
        }

        val voiceStatus = when {
            readyCount == sentences.size && sentences.isNotEmpty() -> "Character voice"
            pending -> "Generating clips · $readyCount/${sentences.size} ready"
            readyCount > 0 -> "$readyCount/${sentences.size} clips ready"
            else -> "System voice · clips unavailable"
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = if (playerActive && player.isBuffering) "$voiceStatus · buffering…" else voiceStatus,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            modifier = Modifier.padding(horizontal = 4.dp),
        )

        Spacer(modifier = Modifier.height(4.dp))

        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
        ) {
            itemsIndexed(sentences) { index, text ->
                val clip = clips.firstOrNull { it.sentenceIndex == index }
                val isActive = playerActive && currentIndex == index
                SentenceRow(
                    text = text,
                    isActive = isActive,
                    clipStatus = clip?.status,
                    buffering = isActive && player.isBuffering,
                    onClick = {
                        if (playerActive) onSeek(index) else onPlayAt(index)
                    },
                )
            }
            item { Spacer(modifier = Modifier.height(96.dp)) }
        }
    }
}

@Composable
private fun SentenceRow(
    text: String,
    isActive: Boolean,
    clipStatus: String?,
    buffering: Boolean,
    onClick: () -> Unit,
) {
    val baseColor = MaterialTheme.colorScheme.onSurface
    val alpha = when {
        isActive -> 1f
        clipStatus == TtsStatus.GENERATING -> 0.75f
        clipStatus == TtsStatus.READY -> 0.55f
        else -> 0.3f
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (clipStatus == TtsStatus.GENERATING || buffering) {
            CircularProgressIndicator(
                modifier = Modifier.size(12.dp),
                strokeWidth = 2.dp,
                color = baseColor.copy(alpha = 0.8f),
            )
            Spacer(modifier = Modifier.width(8.dp))
        }
        Text(
            text = text,
            fontSize = if (isActive) 19.sp else 16.sp,
            lineHeight = if (isActive) 28.sp else 24.sp,
            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
            color = baseColor.copy(alpha = alpha),
        )
    }
}

// --- Mini player pill ---

@Composable
private fun MiniPlayerPill(
    state: PlayerState,
    modifier: Modifier,
    selectedAvatar: VocalAvatar,
    onToggle: () -> Unit,
    onSpeed: () -> Unit,
    onSelectVoice: () -> Unit,
    onSeekTime: (Long) -> Unit,
    onClose: () -> Unit,
) {
    val maxMs = if (state.isMerged) {
        state.durationMs.takeIf { it > 0 } ?: state.sessionDurationMs
    } else {
        state.sessionDurationMs
    }.coerceAtLeast(1L)
    val sliderMax = maxMs.toFloat()
    var dragMs by remember { mutableFloatStateOf(-1f) }
    val sliderValue = if (dragMs >= 0f) dragMs else state.timelinePositionMs.toFloat().coerceIn(0f, sliderMax)

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        colors = CardDefaults.cardColors(containerColor = CognifyColors.DeepNavy),
    ) {
        Column(modifier = Modifier.padding(start = 8.dp, end = 4.dp, top = 10.dp, bottom = 8.dp)) {
            Slider(
                value = sliderValue,
                onValueChange = { dragMs = it },
                onValueChangeFinished = {
                    if (dragMs >= 0f) onSeekTime(dragMs.toLong())
                    dragMs = -1f
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(28.dp),
                valueRange = 0f..sliderMax,
                colors = SliderDefaults.colors(
                    thumbColor = CognifyColors.ElectricVioletLight,
                    activeTrackColor = CognifyColors.ElectricVioletLight,
                    inactiveTrackColor = Color.White.copy(alpha = 0.15f),
                ),
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
            ) {
                Text(
                    text = formatRemaining(sliderValue.toLong()),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.6f),
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = formatRemaining(maxMs),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.6f),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onToggle) {
                    Icon(
                        if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (state.isPlaying) "Pause" else "Play",
                        tint = Color.White,
                        modifier = Modifier.size(26.dp),
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = state.title.ifBlank { "Cognify" },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = if (state.isMerged) {
                            val remaining = if (state.remainingMs > 0) {
                                " · ${formatRemaining(state.remainingMs)} left"
                            } else {
                                ""
                            }
                            "Full session · ${state.sentences.size} sentences$remaining"
                        } else if (state.currentIndex >= 0) {
                            val remaining = if (state.remainingMs > 0) {
                                " · ${formatRemaining(state.remainingMs)} left"
                            } else {
                                ""
                            }
                            "Sentence ${state.currentIndex + 1} of ${state.sentences.size}$remaining"
                        } else {
                            "Ready"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.6f),
                    )
                }

                // Voice chip
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            Brush.verticalGradient(
                                listOf(selectedAvatar.painting.copy(alpha = 0.7f), selectedAvatar.painting.copy(alpha = 0.3f))
                            )
                        )
                        .clickable(onClick = onSelectVoice),
                    contentAlignment = Alignment.Center,
                ) {
                    if (selectedAvatar.imageRes != null) {
                        Image(
                            painter = painterResource(selectedAvatar.imageRes),
                            contentDescription = selectedAvatar.name,
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Text(
                            text = selectedAvatar.name.take(1).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                        )
                    }
                }

                // Speed
                Text(
                    text = "${state.speed}x",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier
                        .clickable(onClick = onSpeed)
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                )

                IconButton(onClick = onClose) {
                    Icon(Icons.Filled.Close, contentDescription = "Stop playback", tint = Color.White.copy(alpha = 0.8f))
                }
            }
        }
    }
}

private fun nextSpeed(current: Float): Float = when {
    current < 0.9f -> 1.0f
    current < 1.1f -> 1.25f
    current < 1.4f -> 1.5f
    else -> 0.75f
}

private fun formatRemaining(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0L)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return if (minutes > 0) "%d:%02d".format(minutes, seconds) else "0:%02d".format(seconds)
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true, showSystemUi = true)
@Composable
private fun SummaryScreenPreview() {
    com.instructai.cognify.ui.theme.CognifyTheme {
        SummaryScreen(reviewId = 1, onBack = {})
    }
}
