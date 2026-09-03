package com.instructai.cognify.ui.flashcards

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.FlashcardRepository
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.repository.StudyStatsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FlashcardState(
    val isLoading: Boolean = true,
    val cards: List<FlashcardCard> = emptyList(),
    val currentIndex: Int = 0,
    val isFlipped: Boolean = false,
    val cardsReviewed: Int = 0,
    val cardsKnown: Int = 0,
    val cardsUnknown: Int = 0,
    val isSessionComplete: Boolean = false,
    val dueCount: Int = 0,
    val dueMode: Boolean = false,
)

data class FlashcardCard(
    val id: Long,
    val front: String,
    val back: String,
    val isNew: Boolean,
    val intervalDays: Long,
)

@HiltViewModel
class FlashcardViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val flashcardRepository: FlashcardRepository,
    private val studyStatsRepository: StudyStatsRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(FlashcardState())
    val state: StateFlow<FlashcardState> = _state.asStateFlow()

    private var currentReviewId: Long? = null
    private var currentSetId: Long? = null

    fun loadCards(reviewId: Long, setId: Long? = null) {
        currentReviewId = reviewId
        currentSetId = setId
        viewModelScope.launch {
            try {
                val reviewData = reviewRepository.getFlashcardReviewDataForReview(reviewId).first()
                val dataById = reviewData.associateBy { it.flashcardId }
                val cards = reviewRepository.getFlashcards(reviewId, setId).first().map { card ->
                    val rd = dataById[card.id]
                    FlashcardCard(
                        id = card.id,
                        front = card.frontText,
                        back = card.backText,
                        isNew = rd?.lastReviewedAt == null,
                        intervalDays = if (rd?.lastReviewedAt == null) 0L
                        else ((rd.nextReviewAt - rd.lastReviewedAt) / 86_400_000L),
                    )
                }
                _state.value = FlashcardState(
                    isLoading = false,
                    cards = cards,
                    dueMode = _state.value.dueMode,
                )
            } catch (e: Exception) {
                logger.log("FlashcardViewModel", "loadCards($reviewId) failed", e)
                _state.value = _state.value.copy(isLoading = false)
            }
        }
    }

    fun loadDueCards(reviewId: Long? = null) {
        currentReviewId = reviewId
        viewModelScope.launch {
            try {
                val due = reviewRepository.dueDeck(reviewId).first()
                val cards = due.map { FlashcardCard(it.id, it.frontText, it.backText, false, 0L) }
                _state.value = FlashcardState(
                    isLoading = false,
                    dueMode = true,
                    dueCount = due.size,
                    cards = cards,
                )
            } catch (e: Exception) {
                logger.log("FlashcardViewModel", "loadDueCards failed", e)
                _state.value = _state.value.copy(isLoading = false)
            }
        }
    }

    fun resetSession() {
        val dueMode = _state.value.dueMode
        val reviewId = currentReviewId
        _state.value = FlashcardState(dueMode = dueMode)
        when {
            dueMode -> loadDueCards(reviewId)
            else -> reviewId?.let { loadCards(it, currentSetId) }
        }
    }

    fun flipCard() {
        _state.value = _state.value.copy(isFlipped = !_state.value.isFlipped)
    }

    fun rateCard(card: FlashcardCard, isCorrect: Boolean) {
        viewModelScope.launch {
            try {
                flashcardRepository.reviewFlashcard(card.id, if (isCorrect) 5 else 2)
                if (isCorrect) {
                    studyStatsRepository.recordActivity(flashcardsReviewed = 1)
                }
            } catch (e: Exception) {
                logger.log("FlashcardViewModel", "rateCard(${card.id}, $isCorrect) failed", e)
            }
        }

        val current = _state.value
        val nextIndex = current.currentIndex + 1

        if (nextIndex >= current.cards.size) {
            _state.value = current.copy(
                isSessionComplete = true,
                isFlipped = false,
                cardsReviewed = current.cardsReviewed + 1,
                cardsKnown = if (isCorrect) current.cardsKnown + 1 else current.cardsKnown,
                cardsUnknown = if (!isCorrect) current.cardsUnknown + 1 else current.cardsUnknown,
            )
        } else {
            _state.value = current.copy(
                currentIndex = nextIndex,
                isFlipped = false,
                cardsReviewed = current.cardsReviewed + 1,
                cardsKnown = if (isCorrect) current.cardsKnown + 1 else current.cardsKnown,
                cardsUnknown = if (!isCorrect) current.cardsUnknown + 1 else current.cardsUnknown,
            )
        }
    }
}
