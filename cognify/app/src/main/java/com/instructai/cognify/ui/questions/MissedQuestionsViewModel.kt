package com.instructai.cognify.ui.questions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.ClozeEntity
import com.instructai.cognify.data.local.entity.MissedItemEntity
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.repository.StudyStatsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class MissedQuestion {
    data class Cloze(val item: ClozeEntity) : MissedQuestion()
    data class Practice(val item: PracticeQuestionEntity) : MissedQuestion()
}

data class MissedQuestionsState(
    val items: List<MissedQuestion> = emptyList(),
    val currentIndex: Int = 0,
    val isRevealed: Boolean = false,
    val isAssessed: Boolean = false,
    val selectedAnswer: String? = null,
    val isAnswered: Boolean = false,
    val isCorrect: Boolean? = null,
    val score: Int = 0,
    val isFinished: Boolean = false,
    val isLoading: Boolean = true,
)

@HiltViewModel
class MissedQuestionsViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val studyStatsRepository: StudyStatsRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(MissedQuestionsState())
    val state: StateFlow<MissedQuestionsState> = _state.asStateFlow()

    private var currentReviewId: Long? = null

    fun load(reviewId: Long) {
        currentReviewId = reviewId
        viewModelScope.launch {
            try {
                val cloze = reviewRepository.getMissedClozeItems(reviewId)
                    .map { MissedQuestion.Cloze(it) }
                val practice = reviewRepository.getMissedPracticeQuestions(reviewId)
                    .map { MissedQuestion.Practice(it) }
                _state.value = MissedQuestionsState(
                    items = (cloze + practice).shuffled(),
                    isLoading = false,
                )
            } catch (e: Exception) {
                logger.log("MissedQuestionsViewModel", "load($reviewId) failed", e)
                _state.value = _state.value.copy(isLoading = false)
            }
        }
    }

    fun reveal() {
        _state.value = _state.value.copy(isRevealed = true)
    }

    fun reportSelfAssessment(isCorrect: Boolean) {
        val current = _state.value
        if (current.isAssessed) return
        _state.value = current.copy(
            isAssessed = true,
            score = if (isCorrect) current.score + 1 else current.score,
        )

        val item = current.items.getOrNull(current.currentIndex) as? MissedQuestion.Cloze ?: return
        val reviewId = currentReviewId
        if (reviewId != null) {
            viewModelScope.launch {
                try {
                    if (isCorrect) {
                        reviewRepository.clearMissed(reviewId, MissedItemEntity.TYPE_CLOZE, item.item.id)
                    } else {
                        reviewRepository.markMissed(reviewId, MissedItemEntity.TYPE_CLOZE, item.item.id)
                    }
                } catch (e: Exception) {
                    logger.log("MissedQuestionsViewModel", "cloze missed tracking failed", e)
                }
            }
        }
    }

    fun selectAnswer(answer: String) {
        val current = _state.value
        if (current.isAnswered) return
        val item = current.items.getOrNull(current.currentIndex) as? MissedQuestion.Practice ?: return

        val cleanedAnswer = answer.replace(Regex("^[A-Z]\\)\\s*"), "").trim()
        val cleanedCorrect = item.item.correctAnswer.replace(Regex("^[A-Z]\\)\\s*"), "").trim()
        val isCorrect = cleanedAnswer.equals(cleanedCorrect, ignoreCase = true)

        _state.value = current.copy(
            selectedAnswer = answer,
            isAnswered = true,
            isCorrect = isCorrect,
            score = if (isCorrect) current.score + 1 else current.score,
        )

        val reviewId = currentReviewId
        if (reviewId != null) {
            viewModelScope.launch {
                try {
                    if (isCorrect) {
                        reviewRepository.clearMissed(reviewId, MissedItemEntity.TYPE_PRACTICE, item.item.id)
                    } else {
                        reviewRepository.markMissed(reviewId, MissedItemEntity.TYPE_PRACTICE, item.item.id)
                    }
                } catch (e: Exception) {
                    logger.log("MissedQuestionsViewModel", "practice missed tracking failed", e)
                }
            }
        }
    }

    fun next() {
        val current = _state.value
        val nextIndex = current.currentIndex + 1
        if (nextIndex >= current.items.size) {
            if (!current.isFinished) {
                viewModelScope.launch {
                    try {
                        studyStatsRepository.recordActivity(
                            questionsAnswered = current.items.size,
                        )
                    } catch (e: Exception) {
                        logger.log("MissedQuestionsViewModel", "recordActivity failed", e)
                    }
                }
            }
            _state.value = current.copy(isFinished = true)
        } else {
            _state.value = current.copy(
                currentIndex = nextIndex,
                isRevealed = false,
                isAssessed = false,
                selectedAnswer = null,
                isAnswered = false,
                isCorrect = null,
            )
        }
    }

    fun reset() {
        _state.value = _state.value.copy(
            items = _state.value.items.shuffled(),
            currentIndex = 0,
            isRevealed = false,
            isAssessed = false,
            selectedAnswer = null,
            isAnswered = false,
            isCorrect = null,
            score = 0,
            isFinished = false,
            isLoading = false,
        )
    }
}
