package com.instructai.cognify.ui.reviews

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.MissedItemEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MissedReviewItem(
    val reviewId: Long,
    val title: String,
    val flashcardCount: Int = 0,
    val questionCount: Int = 0,
)

data class DueReviewersUiState(
    val isLoading: Boolean = true,
    val items: List<MissedReviewItem> = emptyList(),
)

@HiltViewModel
class DueReviewersViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DueReviewersUiState())
    val uiState: StateFlow<DueReviewersUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            try {
                reviewRepository.getMissedReviewIds().collect { reviewIds ->
                    val reviews = reviewRepository.getAllReviews().first()
                    val reviewsById = reviews.associateBy { it.id }
                    val items = reviewIds.mapNotNull { id ->
                        val review = reviewsById[id] ?: return@mapNotNull null
                        MissedReviewItem(reviewId = id, title = review.title.ifBlank { "Untitled Reviewer" })
                    }
                    _uiState.value = _uiState.value.copy(isLoading = false, items = items)
                    refreshCounts(items.map { it.reviewId })
                }
            } catch (e: Exception) {
                logger.log("DueReviewersViewModel", "missed review ids flow error", e)
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    private fun refreshCounts(reviewIds: List<Long>) {
        if (reviewIds.isEmpty()) return
        viewModelScope.launch {
            try {
                val counts = reviewIds.associateWith { id ->
                    val flashcards = reviewRepository
                        .getMissedCountByType(id, MissedItemEntity.TYPE_FLASHCARD).first()
                    val cloze = reviewRepository
                        .getMissedCountByType(id, MissedItemEntity.TYPE_CLOZE).first()
                    val practice = reviewRepository
                        .getMissedCountByType(id, MissedItemEntity.TYPE_PRACTICE).first()
                    flashcards to (cloze + practice)
                }
                _uiState.value = _uiState.value.copy(
                    items = _uiState.value.items.map { item ->
                        val countsFor = counts[item.reviewId]
                        if (countsFor != null) {
                            item.copy(
                                flashcardCount = countsFor.first,
                                questionCount = countsFor.second,
                            )
                        } else item
                    },
                )
            } catch (e: Exception) {
                logger.log("DueReviewersViewModel", "refreshCounts failed", e)
            }
        }
    }
}
