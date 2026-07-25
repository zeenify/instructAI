package com.instructai.cognify.ui.practice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import com.instructai.cognify.data.repository.ReviewRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PracticeState(
    val questions: List<PracticeQuestionEntity> = emptyList(),
    val currentIndex: Int = 0,
    val selectedAnswer: String? = null,
    val isAnswered: Boolean = false,
    val isCorrect: Boolean? = null,
    val score: Int = 0,
    val maxScore: Int = 0,
    val isFinished: Boolean = false,
    val isLoading: Boolean = true,
    val showResult: Boolean = false,
    val showTimer: Boolean = false,
    val timeRemaining: Long = 0L,
)

@HiltViewModel
class PracticeViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PracticeState())
    val state: StateFlow<PracticeState> = _state.asStateFlow()

    fun loadQuestions(reviewId: Long) {
        viewModelScope.launch {
            reviewRepository.getPracticeQuestions(reviewId).collect { questions ->
                _state.value = _state.value.copy(
                    questions = questions.shuffled(),
                    isLoading = false,
                    maxScore = questions.size,
                )
            }
        }
    }

    fun selectAnswer(answer: String) {
        if (_state.value.isAnswered) return
        val current = _state.value
        val question = current.questions.getOrNull(current.currentIndex) ?: return

        val isCorrect = answer.equals(question.correctAnswer, ignoreCase = true)

        _state.value = current.copy(
            selectedAnswer = answer,
            isAnswered = true,
            isCorrect = isCorrect,
            score = if (isCorrect) current.score + 1 else current.score,
        )
    }

    fun nextQuestion() {
        val current = _state.value
        val nextIndex = current.currentIndex + 1

        if (nextIndex >= current.questions.size) {
            _state.value = current.copy(
                isFinished = true,
                showResult = true,
            )
        } else {
            _state.value = current.copy(
                currentIndex = nextIndex,
                selectedAnswer = null,
                isAnswered = false,
                isCorrect = null,
            )
        }
    }

    fun reset() {
        _state.value = PracticeState(
            questions = _state.value.questions.shuffled(),
            maxScore = _state.value.questions.size,
        )
    }
}
