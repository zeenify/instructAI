package com.instructai.cognify.ui.reviews

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.ReviewEntity
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
)

@HiltViewModel
class ReviewsViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReviewsUiState())
    val uiState: StateFlow<ReviewsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            reviewRepository.getAllReviews().collect { reviews ->
                _uiState.value = ReviewsUiState(
                    isLoading = false,
                    reviews = reviews,
                )
            }
        }
    }

    fun deleteReview(id: Long) {
        viewModelScope.launch {
            reviewRepository.deleteReview(id)
        }
    }
}
