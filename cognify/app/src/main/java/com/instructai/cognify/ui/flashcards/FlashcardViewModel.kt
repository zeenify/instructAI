package com.instructai.cognify.ui.flashcards

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.FlashcardEntity
import com.instructai.cognify.data.repository.FlashcardRepository
import com.instructai.cognify.data.repository.ReviewRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FlashcardSessionState(
    val flashcards: List<FlashcardEntity> = emptyList(),
    val currentIndex: Int = 0,
    val isFlipped: Boolean = false,
    val isSessionComplete: Boolean = false,
    val cardsReviewed: Int = 0,
    val cardsKnown: Int = 0,
    val cardsUnknown: Int = 0,
    val isLoading: Boolean = true,
)

@HiltViewModel
class FlashcardViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val flashcardRepository: FlashcardRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(FlashcardSessionState())
    val state: StateFlow<FlashcardSessionState> = _state.asStateFlow()

    fun loadFlashcards(reviewId: Long) {
        viewModelScope.launch {
            reviewRepository.getFlashcards(reviewId).collect { cards ->
                _state.value = _state.value.copy(
                    flashcards = cards.shuffled(),
                    isLoading = false,
                )
            }
        }
    }

    fun flipCard() {
        _state.value = _state.value.copy(isFlipped = !_state.value.isFlipped)
    }

    fun rateCard(quality: Int) {
        val current = _state.value
        val card = current.flashcards.getOrNull(current.currentIndex) ?: return

        viewModelScope.launch {
            flashcardRepository.reviewFlashcard(card.id, quality)
        }

        val isKnown = quality >= 3
        val nextIndex = current.currentIndex + 1

        if (nextIndex >= current.flashcards.size) {
            _state.value = current.copy(
                isSessionComplete = true,
                cardsReviewed = current.cardsReviewed + 1,
                cardsKnown = if (isKnown) current.cardsKnown + 1 else current.cardsKnown,
                cardsUnknown = if (!isKnown) current.cardsUnknown + 1 else current.cardsUnknown,
            )
        } else {
            _state.value = current.copy(
                currentIndex = nextIndex,
                isFlipped = false,
                cardsReviewed = current.cardsReviewed + 1,
                cardsKnown = if (isKnown) current.cardsKnown + 1 else current.cardsKnown,
                cardsUnknown = if (!isKnown) current.cardsUnknown + 1 else current.cardsUnknown,
            )
        }
    }

    fun resetSession() {
        _state.value = FlashcardSessionState(
            flashcards = _state.value.flashcards.shuffled(),
        )
    }
}
