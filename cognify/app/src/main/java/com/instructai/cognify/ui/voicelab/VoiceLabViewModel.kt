package com.instructai.cognify.ui.voicelab

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.tts.GenResult
import com.instructai.cognify.data.tts.PrototypeTtsEngine
import com.instructai.cognify.data.tts.TtsEngineType
import com.instructai.cognify.data.tts.VoiceLabVoice
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject

data class VoiceLabState(
    val voices: List<VoiceLabVoice> = defaultVoices(),
    val selectedVoiceId: String = "kokoro-heart",
    val text: String = "Hey! Flashcard time. The mitochondria is the powerhouse of the cell. Remember the main idea, and you are good to go!",
    val isGenerating: Boolean = false,
    val isPlaying: Boolean = false,
    val modelStatus: List<Pair<String, Long>> = emptyList(),
    val lastResult: GenResult? = null,
    val history: List<GenResult> = emptyList(),
    val error: String? = null,
)

private val SAMPLE_PRESETS = listOf(
    "Hey! Flashcard time. The mitochondria is the powerhouse of the cell. Remember the main idea, and you are good to go!",
    "Good job! You got it right. Keep that streak going, champion!",
    "A new flashcard is ready for you. Focus, think hard, and let's review the key ideas.",
    "Almost there. Take a deep breath, and try the question one more time.",
)

fun defaultVoices(): List<VoiceLabVoice> = listOf(
    VoiceLabVoice("kokoro-heart", "Heart - Kokoro (playful girl)", TtsEngineType.KOKORO, sid = 0),
    VoiceLabVoice("kokoro-bella", "Bella - Kokoro (soft girl)", TtsEngineType.KOKORO, sid = 1),
    VoiceLabVoice("kokoro-michael", "Michael - Kokoro (calm male)", TtsEngineType.KOKORO, sid = 7),
    VoiceLabVoice("kokoro-alpha", "Alpha - Kokoro (anime girl)", TtsEngineType.KOKORO, sid = 27),
    VoiceLabVoice("pocket-peter", "Peter Griffin clone - Pocket TTS (full clip)", TtsEngineType.POCKET, referenceFile = "peter-22050.wav"),
    VoiceLabVoice("pocket-peter-short", "Peter Griffin clone - Pocket TTS (trimmed clip)", TtsEngineType.POCKET, referenceFile = "peter-22050-short.wav"),
    VoiceLabVoice("pocket-makima-1a", "Makima clone - Pocket TTS (1a, BEST)", TtsEngineType.POCKET, referenceFile = "makima-1a-full.wav"),
    VoiceLabVoice("pocket-makima-95", "Makima clone - Pocket TTS (95, 2nd best)", TtsEngineType.POCKET, referenceFile = "makima-95-full.wav"),
    VoiceLabVoice("pocket-makima-96", "Makima clone - Pocket TTS (1a+95 combo = 96)", TtsEngineType.POCKET, referenceFile = "makima-96.wav"),
    VoiceLabVoice("pocket-shinobu-33", "Shinobu clone - Pocket TTS (33 likes)", TtsEngineType.POCKET, referenceFile = "shinobu-33.wav"),
    VoiceLabVoice("pocket-shinobu-30", "Shinobu clone - Pocket TTS (30 likes)", TtsEngineType.POCKET, referenceFile = "shinobu-30.wav"),
    VoiceLabVoice("pocket-shinobu-25", "Shinobu clone - Pocket TTS (25 likes)", TtsEngineType.POCKET, referenceFile = "shinobu-25.wav"),
    VoiceLabVoice("pocket-shinobu-15", "Shinobu clone - Pocket TTS (15 likes)", TtsEngineType.POCKET, referenceFile = "shinobu-15.wav"),
    VoiceLabVoice("pocket-shinobu-9", "Shinobu clone - Pocket TTS (9 likes)", TtsEngineType.POCKET, referenceFile = "shinobu-9.wav"),
    VoiceLabVoice("pocket-shinobu-6", "Shinobu clone - Pocket TTS (6 likes)", TtsEngineType.POCKET, referenceFile = "shinobu-6.wav"),
    VoiceLabVoice("pocket-shinobu-2", "Shinobu clone - Pocket TTS (2 likes)", TtsEngineType.POCKET, referenceFile = "shinobu-2.wav"),
    VoiceLabVoice("pocket-shinobu-1", "Shinobu clone - Pocket TTS (1 like)", TtsEngineType.POCKET, referenceFile = "shinobu-1.wav"),
)

@HiltViewModel
class VoiceLabViewModel @Inject constructor(
    application: Application,
    @ApplicationContext private val appContext: Context,
    logger: AppLogger,
) : AndroidViewModel(application) {

    private val engine: PrototypeTtsEngine = PrototypeTtsEngine(logger)

    private val _state = MutableStateFlow(VoiceLabState())
    val state: StateFlow<VoiceLabState> = _state.asStateFlow()

    init {
        refreshModelStatus()
    }

    fun selectVoice(id: String) {
        _state.value = _state.value.copy(selectedVoiceId = id)
    }

    fun setText(t: String) {
        _state.value = _state.value.copy(text = t)
    }

    fun usePreset(i: Int) {
        if (i in SAMPLE_PRESETS.indices) _state.value = _state.value.copy(text = SAMPLE_PRESETS[i])
    }

    fun refreshModelStatus() {
        val status = engine.modelStatus(appContext)
        _state.value = _state.value.copy(modelStatus = status)
    }

    fun generate() {
        val s = _state.value
        if (s.isGenerating) return
        if (s.text.isBlank()) return
        val voice = s.voices.firstOrNull { it.id == s.selectedVoiceId } ?: s.voices.first()
        val text = s.text
        val ctx = appContext
        viewModelScope.launch {
            _state.value = _state.value.copy(isGenerating = true, error = null)
            val result = withContext(Dispatchers.IO) {
                engine.generate(ctx, voice, text, File(ctx.cacheDir, "voice_lab"))
            }
            if (result.error == null && result.wavPath != null) {
                engine.play(result.wavPath)
            }
            _state.value = _state.value.copy(
                isGenerating = false,
                isPlaying = result.error == null && result.wavPath != null,
                lastResult = result,
                history = listOf(result) + _state.value.history.take(19),
                error = result.error,
            )
        }
    }

    fun togglePlay() {
        val result = _state.value.lastResult ?: return
        val path = result.wavPath ?: return
        if (engine.isPlaying) {
            engine.stop()
            _state.value = _state.value.copy(isPlaying = false)
        } else {
            engine.play(path)
            _state.value = _state.value.copy(isPlaying = true)
        }
    }

    fun playPath(path: String?) {
        path ?: return
        engine.stop()
        engine.play(path)
        _state.value = _state.value.copy(isPlaying = true)
    }

    fun stopPlayback() {
        engine.stop()
        _state.value = _state.value.copy(isPlaying = false)
    }

    override fun onCleared() {
        engine.release()
        super.onCleared()
    }
}
