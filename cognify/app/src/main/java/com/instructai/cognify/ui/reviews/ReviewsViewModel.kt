package com.instructai.cognify.ui.reviews

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReviewsUiState(
    val isLoading: Boolean = true,
    val reviews: List<ReviewEntity> = emptyList(),
    val deleteTarget: ReviewEntity? = null,
    val highlightReviewId: Long? = null,
)

@HiltViewModel
class ReviewsViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReviewsUiState())
    val uiState: StateFlow<ReviewsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            try {
                reviewRepository.getAllReviews().collect { reviews ->
                    _uiState.value = ReviewsUiState(
                        isLoading = false,
                        reviews = reviews,
                        highlightReviewId = _uiState.value.highlightReviewId,
                    )
                }
            } catch (e: Exception) {
                logger.log("ReviewsViewModel", "getAllReviews flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                reviewRepository.pendingHighlight.collect { id ->
                    if (id != null) {
                        _uiState.value = _uiState.value.copy(highlightReviewId = id)
                        reviewRepository.clearPendingHighlight()
                    }
                }
            } catch (e: Exception) {
                logger.log("ReviewsViewModel", "pendingHighlight flow error", e)
            }
        }
    }

    fun clearHighlight() {
        _uiState.value = _uiState.value.copy(highlightReviewId = null)
    }

    fun requestDelete(review: ReviewEntity) {
        _uiState.value = _uiState.value.copy(deleteTarget = review)
    }

    fun confirmDelete() {
        val review = _uiState.value.deleteTarget ?: return
        _uiState.value = _uiState.value.copy(deleteTarget = null)
        viewModelScope.launch {
            reviewRepository.deleteReview(review.id)
        }
    }

    fun cancelDelete() {
        _uiState.value = _uiState.value.copy(deleteTarget = null)
    }
}
