package com.instructai.cognify.ui.stats

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.dao.RecentSessionInfo
import com.instructai.cognify.data.local.dao.ReviewDao
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.DailyActivity
import com.instructai.cognify.data.repository.StudyStatsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import javax.inject.Inject

data class StatsState(
    val totalReviews: Int = 0,
    val studyStreak: Int = 0,
    val bestStreak: Int = 0,
    val weeklyActivity: Map<DayOfWeek, Int> = emptyMap(),
    val totalFlashcards: Int = 0,
    val totalQuestions: Int = 0,
    val avgScore: Float? = null,
    val totalSessions: Int = 0,
    val dailyActivity: List<DailyActivity> = emptyList(),
    val recentSessions: List<RecentSessionInfo> = emptyList(),
    val isLoading: Boolean = true,
)

@HiltViewModel
class StatsViewModel @Inject constructor(
    private val reviewDao: ReviewDao,
    private val studyStatsRepository: StudyStatsRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(StatsState())
    val state: StateFlow<StatsState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            try {
                reviewDao.getAllReviews().collect { reviews ->
                    _state.value = _state.value.copy(totalReviews = reviews.size, isLoading = false)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "review count flow error", e)
                _state.value = _state.value.copy(isLoading = false)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeCurrentStreak().collect { streak ->
                    _state.value = _state.value.copy(studyStreak = streak, isLoading = false)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "current streak flow error", e)
                _state.value = _state.value.copy(isLoading = false)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeBestStreak().collect { streak ->
                    _state.value = _state.value.copy(bestStreak = streak)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "best streak flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeWeeklyActivity().collect { weekly ->
                    _state.value = _state.value.copy(weeklyActivity = weekly)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "weekly activity flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeTotalFlashcardsReviewed().collect { count ->
                    _state.value = _state.value.copy(totalFlashcards = count)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "flashcards reviewed flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeTotalQuestionsAnswered().collect { count ->
                    _state.value = _state.value.copy(totalQuestions = count)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "questions answered flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeAvgPracticeScore().collect { avg ->
                    _state.value = _state.value.copy(avgScore = avg)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "avg score flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeTotalSessions().collect { count ->
                    _state.value = _state.value.copy(totalSessions = count)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "total sessions flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeDailyActivity(days = 28).collect { days ->
                    _state.value = _state.value.copy(dailyActivity = days)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "daily activity flow error", e)
            }
        }
        viewModelScope.launch {
            try {
                studyStatsRepository.observeRecentSessions(limit = 6).collect { sessions ->
                    _state.value = _state.value.copy(recentSessions = sessions)
                }
            } catch (e: Exception) {
                logger.log("StatsViewModel", "recent sessions flow error", e)
            }
        }
    }
}
