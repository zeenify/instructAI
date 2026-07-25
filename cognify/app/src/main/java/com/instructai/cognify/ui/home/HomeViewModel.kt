package com.instructai.cognify.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.ClassEntity
import com.instructai.cognify.data.local.entity.ReviewEntity
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
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        val user = authRepository.currentUser
        val name = if (user?.role == "student") {
            user.studentProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
        } else {
            user?.teacherProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
        }
        _uiState.value = _uiState.value.copy(
            userName = name ?: user?.email?.substringBefore("@") ?: "Student",
            userEmail = user?.email ?: "",
        )

        viewModelScope.launch {
            reviewRepository.getAllReviews().collect { reviews ->
                _uiState.value = _uiState.value.copy(
                    recentReviews = reviews.take(5),
                    studyStats = _uiState.value.studyStats.copy(
                        reviewsCreated = reviews.size,
                    ),
                )
            }
        }

        viewModelScope.launch {
            reviewRepository.getDueCount().collect { count ->
                _uiState.value = _uiState.value.copy(dueCount = count)
            }
        }

        viewModelScope.launch {
            lmsRepository.getCachedClasses().collect { classes ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    classes = classes,
                )
            }
        }

        viewModelScope.launch {
            lmsRepository.syncAll()
        }
    }
}
