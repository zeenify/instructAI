package com.instructai.cognify.ui.cloze

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.ClozeEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
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
    val isLoading: Boolean = true,
    val isComplete: Boolean = false,
    val correct: Int = 0,
    val incorrect: Int = 0,
)

@HiltViewModel
class ClozeViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(ClozeSessionState())
    val state: StateFlow<ClozeSessionState> = _state.asStateFlow()

    fun loadClozeItems(reviewId: Long) {
        viewModelScope.launch {
            try {
                reviewRepository.getClozeItems(reviewId).collect { items ->
                    _state.value = _state.value.copy(
                        items = items.shuffled(),
                        currentIndex = 0,
                        isRevealed = false,
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

    fun next() {
        val current = _state.value
        val nextIndex = current.currentIndex + 1
        if (nextIndex >= current.items.size) {
            _state.value = current.copy(isComplete = true)
        } else {
            _state.value = current.copy(
                currentIndex = nextIndex,
                isRevealed = false,
            )
        }
    }
}
