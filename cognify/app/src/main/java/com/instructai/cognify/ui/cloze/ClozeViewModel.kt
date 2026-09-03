package com.instructai.cognify.ui.cloze

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.ClozeEntity
import com.instructai.cognify.data.local.entity.MissedItemEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.repository.StudyStatsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ClozeSessionState(
    val items: List<ClozeEntity> = emptyList(),
    val currentIndex: Int = 0,
    val isRevealed: Boolean = false,
    val isAssessed: Boolean = false,
    val isLoading: Boolean = true,
    val isComplete: Boolean = false,
    val correct: Int = 0,
    val incorrect: Int = 0,
)

@HiltViewModel
class ClozeViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val studyStatsRepository: StudyStatsRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(ClozeSessionState())
    val state: StateFlow<ClozeSessionState> = _state.asStateFlow()

    private var currentReviewId: Long? = null

    fun loadClozeItems(reviewId: Long, setId: Long? = null) {
        currentReviewId = reviewId
        viewModelScope.launch {
            try {
                reviewRepository.getClozeItems(reviewId, setId).collect { items ->
                    _state.value = _state.value.copy(
                        items = items.shuffled(),
                        currentIndex = 0,
                        isRevealed = false,
                        isAssessed = false,
                        isLoading = false,
                        isComplete = false,
                        correct = 0,
                        incorrect = 0,
                    )
                }
            } catch (e: Exception) {
                logger.log("ClozeViewModel", "loadClozeItems($reviewId) failed", e)
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
            correct = if (isCorrect) current.correct + 1 else current.correct,
            incorrect = if (!isCorrect) current.incorrect + 1 else current.incorrect,
        )

        val item = current.items.getOrNull(current.currentIndex) ?: return
        val reviewId = currentReviewId
        if (reviewId != null) {
            viewModelScope.launch {
                try {
                    if (isCorrect) {
                        reviewRepository.clearMissed(reviewId, MissedItemEntity.TYPE_CLOZE, item.id)
                    } else {
                        reviewRepository.markMissed(reviewId, MissedItemEntity.TYPE_CLOZE, item.id)
                    }
                } catch (e: Exception) {
                    logger.log("ClozeViewModel", "missed tracking failed", e)
                }
            }
        }
    }

    fun next() {
        val current = _state.value
        val nextIndex = current.currentIndex + 1
        if (nextIndex >= current.items.size) {
            if (!current.isComplete) {
                viewModelScope.launch {
                    try {
                        studyStatsRepository.recordActivity(
                            questionsAnswered = current.items.size,
                        )
                    } catch (e: Exception) {
                        logger.log("ClozeViewModel", "recordActivity failed", e)
                    }
                }
            }
            _state.value = current.copy(isComplete = true)
        } else {
            _state.value = current.copy(
                currentIndex = nextIndex,
                isRevealed = false,
                isAssessed = false,
            )
        }
    }
}
