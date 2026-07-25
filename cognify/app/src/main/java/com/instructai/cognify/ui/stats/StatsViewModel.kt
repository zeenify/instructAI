package com.instructai.cognify.ui.stats

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.dao.ReviewDao
import com.instructai.cognify.data.local.dao.StudyStatsDao
import com.instructai.cognify.data.local.entity.StudyStatsEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject

data class StatsState(
    val totalReviews: Int = 0,
    val studyStreak: Int = 0,
    val weeklyActivity: Map<DayOfWeek, Int> = emptyMap(),
    val isLoading: Boolean = true,
)

@HiltViewModel
class StatsViewModel @Inject constructor(
    private val reviewDao: ReviewDao,
    private val statsDao: StudyStatsDao,
) : ViewModel() {

    private val _state = MutableStateFlow(StatsState())
    val state: StateFlow<StatsState> = _state.asStateFlow()

    init {
        loadStats()
    }

    fun loadStats() {
        viewModelScope.launch {
            val reviews = reviewDao.getAllReviews().first()
            val totalReviews = reviews.size

            val stats: List<StudyStatsEntity> = statsDao.getAllStats()
            val streak = calculateStreak(stats)

            val today = LocalDate.now()
            val startOfWeek = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            val weekly = (0 until 7).associate {
                val day = startOfWeek.plusDays(it.toLong())
                val dayEpoch = day.toEpochDay()
                val count = stats.filter { s -> s.dateEpochDay == dayEpoch }.sumOf { s -> s.questionsAnswered }
                day.dayOfWeek to count
            }

            _state.value = StatsState(
                totalReviews = totalReviews,
                studyStreak = streak,
                weeklyActivity = weekly,
                isLoading = false,
            )
        }
    }

    private fun calculateStreak(stats: List<StudyStatsEntity>): Int {
        if (stats.isEmpty()) return 0
        val sorted = stats.sortedByDescending { it.dateEpochDay }
        var streak = 0
        var current = LocalDate.now().toEpochDay()
        for (s in sorted) {
            if (s.dateEpochDay == current || s.dateEpochDay == current - 1) {
                streak++
                current = s.dateEpochDay
            } else if (s.dateEpochDay < current - 1) {
                break
            }
        }
        return streak
    }
}
