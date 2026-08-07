package com.instructai.cognify.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.ClassEntity
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.AuthRepository
import com.instructai.cognify.data.repository.LmsRepository
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.domain.model.StudyStats
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val isLoading: Boolean = true,
    val isSyncing: Boolean = false,
    val userName: String = "Student",
    val userEmail: String = "",
    val streak: Int = 0,
    val dueCount: Int = 0,
    val recentReviews: List<ReviewEntity> = emptyList(),
    val classes: List<ClassEntity> = emptyList(),
    val studyStats: StudyStats = StudyStats(),
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val lmsRepository: LmsRepository,
    private val authRepository: AuthRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            try {
                authRepository.ensureSession()
                val name = authRepository.getUserDisplayName()
                val email = authRepository.currentUser?.email ?: ""
                _uiState.value = _uiState.value.copy(
                    userName = name ?: "Student",
                    userEmail = email,
                )
            } catch (e: Exception) {
                logger.log("HomeViewModel", "loadData: user info failed", e)
            }
        }

        viewModelScope.launch {
            try {
                reviewRepository.getAllReviews().collect { reviews ->
                    _uiState.value = _uiState.value.copy(
                        recentReviews = reviews.take(5),
                        studyStats = _uiState.value.studyStats.copy(
                            reviewsCreated = reviews.size,
                        ),
                    )
                }
            } catch (e: Exception) {
                logger.log("HomeViewModel", "getAllReviews flow error", e)
            }
        }

        viewModelScope.launch {
            try {
                reviewRepository.getDueCount().collect { count ->
                    _uiState.value = _uiState.value.copy(dueCount = count)
                }
            } catch (e: Exception) {
                logger.log("HomeViewModel", "getDueCount flow error", e)
            }
        }

        viewModelScope.launch {
            try {
                lmsRepository.getCachedClasses().collect { classes ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        classes = classes,
                    )
                }
            } catch (e: Exception) {
                logger.log("HomeViewModel", "getCachedClasses flow error", e)
            }
        }

    }

    fun deleteReview(reviewId: Long) {
        viewModelScope.launch {
            try {
                reviewRepository.deleteReview(reviewId)
            } catch (e: Exception) {
                logger.log("HomeViewModel", "deleteReview failed", e)
            }
        }
    }
}
