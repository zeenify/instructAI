package com.instructai.cognify.audio

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import com.instructai.cognify.MainActivity
import com.instructai.cognify.data.local.dao.TtsClipDao
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.tts.TtsGenerationManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

data class PlayerState(
    val reviewId: Long? = null,
    val characterId: String? = null,
    val characterName: String = "",
    val voiceId: String? = null,
    val title: String = "",
    val sentences: List<String> = emptyList(),
    val currentIndex: Int = -1,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val speed: Float = 1.0f,
    val readyIndices: Set<Int> = emptySet(),
    val errorIndices: Set<Int> = emptySet(),
    val durationsMs: Map<Int, Long> = emptyMap(),
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val timelinePositionMs: Long = 0L,
    val sessionDurationMs: Long = 0L,
    val remainingMs: Long = 0L,
    val errorMessage: String? = null,
    val fallbackAll: Boolean = false,
    val isMerged: Boolean = false,
)

@OptIn(UnstableApi::class)
@Singleton
class PlayerController @Inject constructor(
    @ApplicationContext private val context: Context,
    private val ttsClipDao: TtsClipDao,
    private val logger: AppLogger,
    private val ttsGenerationManager: TtsGenerationManager,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val player: ExoPlayer by lazy {
        ExoPlayer.Builder(context)
            .setAudioAttributes(AudioAttributes.DEFAULT, true)
            .build()
            .apply { addListener(playerListener) }
    }

    val session: MediaSession by lazy {
        MediaSession.Builder(context, player)
            .setCallback(
                object : MediaSession.Callback {
                    override fun onConnect(
                        session: MediaSession,
                        controller: MediaSession.ControllerInfo,
                    ): MediaSession.ConnectionResult {
                        return MediaSession.ConnectionResult.accept(
                            MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS,
                            Player.Commands.Builder()
                                .addAll(MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS)
                                .add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
                                .build(),
                        )
                    }
                },
            )
            .build()
    }

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
                scope.launch { advance() }
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            logger.log("PlayerController", "player error: ${error.errorCodeName}", error)
            _state.update {
                it.copy(errorMessage = "Audio issue — regenerating this sentence.", isBuffering = true)
            }
            scope.launch { requestRegenerate() }
        }
    }

    private val _state = MutableStateFlow(PlayerState())
    val state: StateFlow<PlayerState> = _state.asStateFlow()

    private var observeJob: Job? = null
    private var positionJob: Job? = null
    private var readyMap: Map<Int, String> = emptyMap()
    private var loadedIndex: Int? = null
    private var playbackServiceStarted = false
    private var playbackStarted = false
    private var mergedPath: String? = null

    private var tts: TextToSpeech? = null

    fun play(
        reviewId: Long,
        characterId: String,
        characterName: String = "",
        voiceId: String?,
        title: String,
        sentences: List<String>,
        startIndex: Int = 0,
        fallbackAll: Boolean = false,
    ) {
        if (sentences.isEmpty()) return
        stopInternal()

        val index = startIndex.coerceIn(0, sentences.size - 1)
        _state.value = PlayerState(
            reviewId = reviewId,
            characterId = characterId,
            characterName = characterName,
            voiceId = voiceId,
            title = title,
            sentences = sentences,
            currentIndex = index,
            isPlaying = true,
            speed = _state.value.speed,
            fallbackAll = fallbackAll,
            durationsMs = estimateDurations(sentences),
        )
        session.setSessionActivity(sessionActivityPendingIntent())

        observeJob = scope.launch {
            ttsClipDao.observeClips(reviewId, characterId).collect { clips ->
                readyMap = clips
                    .filter { it.status == "ready" && it.filePath != null }
                    .associate { it.sentenceIndex to it.filePath!! }
                val errorSet = clips.filter { it.status == "error" }.map { it.sentenceIndex }.toSet()
                _state.update {
                    it.copy(
                        readyIndices = readyMap.keys,
                        errorIndices = errorSet,
                        durationsMs = (0 until it.sentences.size).associate { i ->
                            i to (
                                clips
                                    .firstOrNull { c -> c.sentenceIndex == i && c.status == "ready" && c.durationMs != null }
                                    ?.durationMs
                                    ?: estimateFor(it.sentences[i])
                                )
                        },
                    )
                }
                _state.update {
                    it.copy(sessionDurationMs = it.durationsMs.values.sum())
                }
                if (mergedPath == null && !playbackStarted && !fallbackAll && errorSet.isEmpty() && readyMap.size == sentences.size) {
                    startMergedPlayback()
                } else {
                    ensureCurrentClip()
                }
            }
        }

        positionJob = scope.launch {
            while (isActive) {
                val s = _state.value
                val position = player.currentPosition.takeIf { player.duration > 0 } ?: 0L
                if (s.currentIndex >= 0 && s.currentIndex < s.sentences.size) {
                    val realDuration = player.duration.takeIf { it > 0 }
                    val timeline = if (s.isMerged) position else timelineStartMs(s.currentIndex) + position
                    val total = if (s.isMerged) realDuration ?: s.sessionDurationMs else s.sessionDurationMs
                    _state.update {
                        it.copy(
                            positionMs = position,
                            durationMs = realDuration ?: 0L,
                            timelinePositionMs = timeline,
                            sessionDurationMs = if (s.isMerged && realDuration != null) realDuration else it.sessionDurationMs,
                            remainingMs = (total - timeline).coerceAtLeast(0L),
                        )
                    }
                } else {
                    _state.update { it.copy(positionMs = position) }
                }
                delay(500)
            }
        }
    }

    fun resume() {
        val s = _state.value
        if (s.currentIndex < 0) return
        if (!s.isPlaying) {
            _state.update { it.copy(isPlaying = true) }
            if (player.isPlaying) return
            if (player.duration > 0) {
                startPlaybackService()
                player.play()
            } else {
                ensureCurrentClip()
            }
        }
    }

    fun pause() {
        val s = _state.value
        if (s.currentIndex < 0) return
        if (s.isPlaying) {
            if (player.isPlaying) player.pause()
            tts?.stop()
            _state.update { it.copy(isPlaying = false) }
        } else {
            resume()
        }
    }

    fun seekTo(index: Int) {
        val s = _state.value
        if (s.currentIndex < 0) return
        val target = index.coerceIn(0, s.sentences.size - 1)
        if (mergedPath != null) {
            if (target == s.currentIndex && player.isPlaying) return
            _state.update { it.copy(currentIndex = target, positionMs = 0L) }
            player.seekTo(timelineStartMs(target))
            return
        }
        if (target == s.currentIndex && (player.isPlaying || s.isBuffering)) return
        playbackStarted = true
        player.stop()
        player.clearMediaItems()
        tts?.stop()
        loadedIndex = null
        _state.update { it.copy(currentIndex = target, isBuffering = false, positionMs = 0L, durationMs = 0L) }
        ensureCurrentClip()
    }

    fun seekToTime(totalMs: Long) {
        val s = _state.value
        if (s.currentIndex < 0 || s.sentences.isEmpty()) return
        if (mergedPath != null) {
            val (index, _) = locateTime(totalMs.coerceAtLeast(0L))
            player.seekTo(totalMs.coerceAtLeast(0L))
            _state.update { it.copy(currentIndex = index, positionMs = player.currentPosition) }
            return
        }
        val (index, offset) = locateTime(totalMs.coerceAtLeast(0L))
        if (index == s.currentIndex && player.mediaItemCount > 0 && !s.isBuffering) {
            player.seekTo(offset)
            return
        }
        player.stop()
        player.clearMediaItems()
        tts?.stop()
        loadedIndex = null
        playbackStarted = true
        _state.update { it.copy(currentIndex = index, isBuffering = false, positionMs = offset, durationMs = 0L) }
        val path = readyMap[index]
        when {
            s.fallbackAll -> startFallbackTts(index)
            path != null -> startClip(path, index, offset)
            else -> _state.update { it.copy(isBuffering = true) }
        }
    }

    fun setSpeed(rate: Float) {
        val clamped = rate.coerceIn(0.5f, 2.0f)
        _state.update { it.copy(speed = clamped) }
        player.playbackParameters = PlaybackParameters(clamped, 1f)
        tts?.setSpeechRate(clamped)
    }

    fun stop() {
        stopInternal()
        stopPlaybackService()
        _state.value = PlayerState()
    }

    fun isActiveFor(reviewId: Long): Boolean = _state.value.reviewId == reviewId

    private fun startPlaybackService() {
        if (playbackServiceStarted) return
        try {
            val intent = Intent(context, PlaybackService::class.java).apply {
                action = Intent.ACTION_MEDIA_BUTTON
            }
            context.startForegroundService(intent)
            playbackServiceStarted = true
        } catch (e: Exception) {
            logger.log("PlayerController", "startForegroundService failed", e)
        }
    }

    private fun stopPlaybackService() {
        playbackServiceStarted = false
        try {
            context.stopService(Intent(context, PlaybackService::class.java))
        } catch (e: Exception) {
            logger.log("PlayerController", "stopService failed", e)
        }
    }

    private fun stopInternal() {
        observeJob?.cancel()
        observeJob = null
        positionJob?.cancel()
        positionJob = null
        player.stop()
        player.clearMediaItems()
        tts?.stop()
        readyMap = emptyMap()
        loadedIndex = null
        playbackStarted = false
        mergedPath = null
    }

    private fun estimateDurations(sentences: List<String>): Map<Int, Long> =
        sentences.indices.associateWith { estimateFor(sentences[it]) }

    private fun estimateFor(text: String): Long =
        (text.length * 75L).coerceIn(1500L, 30000L)

    private fun timelineStartMs(index: Int): Long =
        _state.value.durationsMs.entries.filter { it.key < index }.sumOf { it.value }

    private fun locateTime(totalMs: Long): Pair<Int, Long> {
        val s = _state.value
        var acc = 0L
        for (i in s.sentences.indices) {
            val d = s.durationsMs[i] ?: estimateFor(s.sentences[i])
            if (totalMs < acc + d) return i to (totalMs - acc).coerceAtLeast(0L)
            acc += d
        }
        return (s.sentences.size - 1) to 0L
    }

    private fun ensureCurrentClip() {
        if (mergedPath != null) return
        val s = _state.value
        if (s.currentIndex < 0 || s.currentIndex >= s.sentences.size) {
            finishPlayback()
            return
        }
        val path = readyMap[s.currentIndex]
        when {
            s.fallbackAll -> {
                if (loadedIndex != s.currentIndex) {
                    loadedIndex = s.currentIndex
                    startFallbackTts(s.currentIndex)
                }
            }
            path != null -> {
                if (loadedIndex != s.currentIndex || player.mediaItemCount == 0) {
                    loadedIndex = s.currentIndex
                    startClip(path, s.currentIndex)
                } else if (s.isPlaying && !player.isPlaying && player.playbackState != Player.STATE_BUFFERING) {
                    player.play()
                }
            }
            else -> {
                loadedIndex = null
                _state.update {
                    it.copy(
                        isBuffering = true,
                        errorMessage = if (s.errorIndices.contains(s.currentIndex)) {
                            "Audio unavailable — retrying generation."
                        } else {
                            it.errorMessage
                        },
                    )
                }
            }
        }
    }

    private fun startClip(path: String, index: Int, offsetMs: Long = 0L) {
        val s = _state.value
        try {
            player.stop()
            player.setMediaItem(
                MediaItem.Builder()
                    .setUri(Uri.fromFile(File(path)))
                    .setMediaMetadata(
                        MediaMetadata.Builder()
                            .setTitle("Sentence ${index + 1} of ${s.sentences.size}")
                            .setArtist(s.title.ifBlank { "Cognify" })
                            .build()
                    )
                    .build()
            )
            player.playbackParameters = PlaybackParameters(s.speed, 1f)
            player.prepare()
            if (offsetMs > 0) player.seekTo(offsetMs)
            startPlaybackService()
            player.play()
            playbackStarted = true
            loadedIndex = index
            _state.update { it.copy(isBuffering = false, isPlaying = true, errorMessage = null) }
        } catch (e: Exception) {
            logger.log("PlayerController", "startClip failed", e)
            _state.update { it.copy(errorMessage = "Clip unavailable — regenerating.", isBuffering = true) }
            requestRegenerate()
        }
    }

    private fun startMergedPlayback() {
        val s = _state.value
        val paths = s.sentences.indices.mapNotNull { readyMap[it] }
        if (paths.size != s.sentences.size) return
        val outFile = File(
            File(context.cacheDir, "merged"),
            "merged_${s.reviewId}_${s.characterId?.take(8)}.mp3"
        )
        mergedPath = outFile.absolutePath
        playbackStarted = true
        scope.launch {
            val merged = withContext(Dispatchers.IO) {
                try {
                    mergeMp3s(paths, outFile)
                    outFile
                } catch (e: Exception) {
                    logger.log("PlayerController", "merge failed", e)
                    null
                }
            }
            if (merged == null) {
                mergedPath = null
                ensureCurrentClip()
                return@launch
            }
            try {
                player.stop()
                player.setMediaItem(
                    MediaItem.Builder()
                        .setUri(Uri.fromFile(merged))
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle(s.title.ifBlank { "Cognify" })
                                .setArtist(s.characterName.ifBlank { "Cognify" })
                                .build()
                        )
                        .build()
                )
                player.playbackParameters = PlaybackParameters(s.speed, 1f)
                player.prepare()
                startPlaybackService()
                player.play()
                loadedIndex = 0
                _state.update {
                    it.copy(isBuffering = false, isPlaying = true, isMerged = true, errorMessage = null)
                }
            } catch (e: Exception) {
                logger.log("PlayerController", "startMergedPlayback failed", e)
                mergedPath = null
                ensureCurrentClip()
            }
        }
    }

    private fun mergeMp3s(files: List<String>, out: File) {
        out.parentFile?.mkdirs()
        out.outputStream().use { os ->
            files.forEach { path ->
                val bytes = File(path).readBytes()
                var start = 0
                if (
                    bytes.size > 10 &&
                    bytes[0] == 'I'.code.toByte() &&
                    bytes[1] == 'D'.code.toByte() &&
                    bytes[2] == '3'.code.toByte()
                ) {
                    val size =
                        ((bytes[6].toInt() and 0x7F) shl 21) or
                            ((bytes[7].toInt() and 0x7F) shl 14) or
                            ((bytes[8].toInt() and 0x7F) shl 7) or
                            (bytes[9].toInt() and 0x7F)
                    start = 10 + size
                }
                os.write(bytes, start, bytes.size - start)
            }
        }
    }

    private fun sessionActivityPendingIntent(): PendingIntent {
        val s = _state.value
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_OPEN_REVIEW, s.reviewId ?: -1L)
        }
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun advance() {
        if (mergedPath != null) {
            finishPlayback()
            return
        }
        val s = _state.value
        if (s.currentIndex >= s.sentences.size - 1) {
            finishPlayback()
            return
        }
        player.stop()
        player.clearMediaItems()
        loadedIndex = null
        _state.update {
            it.copy(currentIndex = it.currentIndex + 1, isBuffering = false, positionMs = 0L, durationMs = 0L)
        }
        ensureCurrentClip()
    }

    private fun finishPlayback() {
        player.stop()
        player.clearMediaItems()
        tts?.stop()
        observeJob?.cancel()
        observeJob = null
        loadedIndex = null
        playbackStarted = false
        mergedPath = null
        stopPlaybackService()
        _state.update { it.copy(isPlaying = false, isBuffering = false, currentIndex = -1) }
    }

    private fun requestRegenerate() {
        val s = _state.value
        if (mergedPath != null) {
            mergedPath = null
            player.stop()
            player.clearMediaItems()
            loadedIndex = null
            ensureCurrentClip()
            return
        }
        val path = readyMap[s.currentIndex]
        if (path != null) {
            try {
                File(path).delete()
            } catch (e: Exception) {
                logger.log("PlayerController", "clip delete failed", e)
            }
        }
        player.stop()
        player.clearMediaItems()
        loadedIndex = null
        val reviewId = s.reviewId ?: return
        val characterId = s.characterId ?: return
        val voiceId = s.voiceId ?: return
        ttsGenerationManager.enqueueClips(reviewId, characterId, voiceId)
    }

    private fun startFallbackTts(index: Int) {
        val s = _state.value
        val text = s.sentences.getOrNull(index) ?: run { finishPlayback(); return }
        ensureTts()
        val engine = tts
        if (engine == null) {
            advance()
            return
        }
        _state.update { it.copy(isBuffering = false, isPlaying = true, errorMessage = null) }
        engine.setSpeechRate(s.speed)
        val result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cognify_$index")
        if (result == TextToSpeech.ERROR) advance()
    }

    private fun ensureTts() {
        if (tts != null) return
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) = Unit
                    override fun onDone(utteranceId: String?) {
                        scope.launch { advance() }
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        scope.launch { advance() }
                    }
                })
            }
        }
    }
}
