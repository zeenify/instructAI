package com.instructai.cognify.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import com.instructai.cognify.data.logging.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Short "hear this narrator" samples for the voice picker.
 *
 * Character voices ship as pre-generated mp3s in assets/voice_previews (real
 * Fish Audio renders made at build time), so previews are instant and identical
 * on every device. Local/system narrators have no server voice, so those fall
 * back to the device TTS engine as an approximation.
 */
@Singleton
class VoicePreviewPlayer @Inject constructor(
    @ApplicationContext private val context: Context,
    private val logger: AppLogger,
) {
    private val _playingVoiceId = MutableStateFlow<String?>(null)
    val playingVoiceId: StateFlow<String?> = _playingVoiceId.asStateFlow()

    private var mediaPlayer: MediaPlayer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingTtsLine: String? = null

    fun toggle(voiceId: String?, name: String) {
        val key = voiceId ?: SYSTEM_KEY
        if (_playingVoiceId.value == key) {
            stop()
        } else {
            stop()
            play(voiceId, name, key)
        }
    }

    fun stop() {
        _playingVoiceId.value = null
        pendingTtsLine = null
        mediaPlayer?.let { mp ->
            runCatching { mp.stop() }
            runCatching { mp.release() }
        }
        mediaPlayer = null
        tts?.stop()
    }

    fun dispose() {
        stop()
        tts?.shutdown()
        tts = null
    }

    private fun play(voiceId: String?, name: String, key: String) {
        _playingVoiceId.value = key
        if (voiceId != null && hasPreviewAsset(voiceId)) {
            try {
                val fd = context.assets.openFd("voice_previews/$voiceId.mp3")
                val mp = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
                    fd.close()
                    setOnCompletionListener { if (_playingVoiceId.value == key) stop() }
                    setOnErrorListener { _, what, extra ->
                        logger.log("VoicePreviewPlayer", "playback error what=$what extra=$extra")
                        stop()
                        true
                    }
                    prepare()
                    start()
                }
                mediaPlayer = mp
                return
            } catch (e: Exception) {
                logger.log("VoicePreviewPlayer", "asset preview failed for $voiceId", e)
                _playingVoiceId.value = null
                return
            }
        }
        speakLine(key, "Hi! I am $name. Let me read your summaries for you.")
    }

    private fun speakLine(key: String, line: String) {
        val engine = ensureTts()
        if (!ttsReady) {
            pendingTtsLine = line
            return
        }
        val spoken = tts?.speak(line, TextToSpeech.QUEUE_FLUSH, null, "preview_$key")
        if (spoken != TextToSpeech.SUCCESS) {
            _playingVoiceId.value = null
        }
    }

    private fun ensureTts(): TextToSpeech? {
        if (tts != null) return tts
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                ttsReady = true
                pendingTtsLine?.let { line ->
                    pendingTtsLine = null
                    if (_playingVoiceId.value != null) {
                        val spoken = tts?.speak(line, TextToSpeech.QUEUE_FLUSH, null, "preview_pending")
                        if (spoken != TextToSpeech.SUCCESS) _playingVoiceId.value = null
                    }
                }
            } else {
                logger.log("VoicePreviewPlayer", "TTS init failed: $status")
                ttsReady = false
                pendingTtsLine = null
                _playingVoiceId.value = null
            }
        }
        return tts
    }

    private fun hasPreviewAsset(voiceId: String): Boolean =
        runCatching {
            context.assets.open("voice_previews/$voiceId.mp3").use { true }
        }.getOrDefault(false)
}

private const val SYSTEM_KEY = "system"
