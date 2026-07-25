package com.instructai.cognify.ui.audio

import android.speech.tts.TextToSpeech
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.repository.ReviewRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

data class AudioState(
    val content: String = "",
    val isLoading: Boolean = true,
    val isPlaying: Boolean = false,
    val speed: Float = 1.0f,
    val progress: Float = 0f,
)

@HiltViewModel
class AudioViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AudioState())
    val state: StateFlow<AudioState> = _state.asStateFlow()

    private var tts: TextToSpeech? = null

    fun loadContent(reviewId: Long) {
        viewModelScope.launch {
            val review = reviewRepository.getReviewById(reviewId)
            val text = review?.studyGuide?.takeIf { it.isNotBlank() }
                ?: "No study guide available. Generate a reviewer first to use audio mode."
            _state.value = _state.value.copy(
                content = text,
                isLoading = false,
            )
        }
    }

    fun initTts(onReady: (TextToSpeech) -> Unit) {
        tts = TextToSpeech(null) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                tts?.setSpeechRate(state.value.speed)
                onReady(tts!!)
            }
        }
    }

    fun play() {
        tts?.speak(state.value.content, TextToSpeech.QUEUE_FLUSH, null, null)
        _state.value = _state.value.copy(isPlaying = true)
    }

    fun pause() {
        tts?.stop()
        _state.value = _state.value.copy(isPlaying = false)
    }

    fun setSpeed(speed: Float) {
        _state.value = _state.value.copy(speed = speed)
        tts?.setSpeechRate(speed)
        if (_state.value.isPlaying) {
            tts?.speak(state.value.content, TextToSpeech.QUEUE_FLUSH, null, null)
        }
    }

    override fun onCleared() {
        super.onCleared()
        tts?.stop()
        tts?.shutdown()
    }
}
