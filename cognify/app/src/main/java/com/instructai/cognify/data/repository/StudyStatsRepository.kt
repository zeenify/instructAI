package com.instructai.cognify.data.repository

import com.instructai.cognify.data.local.dao.CompletedSessionDao
import com.instructai.cognify.data.local.dao.StudyStatsDao
import com.instructai.cognify.data.local.entity.CompletedSessionEntity
import com.instructai.cognify.data.local.entity.StudyStatsEntity
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import java.time.DayOfWeek
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StudyStatsRepository @Inject constructor(
    private val statsDao: StudyStatsDao,
    private val completedSessionDao: CompletedSessionDao,
) {

    suspend fun recordActivity(
        flashcardsReviewed: Int = 0,
        questionsAnswered: Int = 0,
        reviewsCreated: Int = 0,
        practiceAccuracy: Float? = null,
    ) {
        val today = LocalDate.now().toEpochDay()
        val existing = statsDao.getStatsByDate(today)
        val updated = (existing ?: StudyStatsEntity(dateEpochDay = today)).let {
            it.copy(
                reviewsCreated = it.reviewsCreated + reviewsCreated,
                flashcardsReviewed = it.flashcardsReviewed + flashcardsReviewed,
                questionsAnswered = it.questionsAnswered + questionsAnswered,
                averageScore = when {
                    practiceAccuracy == null -> it.averageScore
                    it.averageScore <= 0f -> practiceAccuracy
                    else -> (it.averageScore + practiceAccuracy) / 2f
                },
            )
        }
        statsDao.insert(updated)
    }

    fun observeAllStats(): Flow<List<StudyStatsEntity>> = statsDao.observeAllStats()

    fun observeCurrentStreak(): Flow<Int> =
        observeAllStats().map { stats -> currentStreak(stats.map { it.dateEpochDay }) }

    fun observeBestStreak(): Flow<Int> =
        observeAllStats().map { stats -> bestStreak(stats.map { it.dateEpochDay }) }

    fun observeWeeklyActivity(): Flow<Map<DayOfWeek, Int>> =
        observeAllStats().map { stats ->
            val today = LocalDate.now()
            (0L until 7L).associate { offset ->
                val day = today.minusDays(6 - offset)
                val count = stats
                    .filter { it.dateEpochDay == day.toEpochDay() }
                    .sumOf { it.flashcardsReviewed + it.questionsAnswered + it.reviewsCreated }
                day.dayOfWeek to count
            }
        }

    fun observeTotalFlashcardsReviewed(): Flow<Int> =
        observeAllStats().map { stats -> stats.sumOf { it.flashcardsReviewed } }

    fun observeTotalQuestionsAnswered(): Flow<Int> =
        observeAllStats().map { stats -> stats.sumOf { it.questionsAnswered } }

    fun observeAvgPracticeScore(): Flow<Float?> =
        observeAllStats().map { stats ->
            val scored = stats.filter { it.averageScore > 0f }
            if (scored.isEmpty()) null else scored.map { it.averageScore }.average().toFloat()
        }

    suspend fun recordSessionCompleted(reviewId: Long, type: String, setId: Long?) {
        completedSessionDao.insertIgnore(
            CompletedSessionEntity(
                reviewId = reviewId,
                type = type,
                setId = setId ?: CompletedSessionEntity.NO_SET,
                dateEpochDay = LocalDate.now().toEpochDay(),
            )
        )
    }

    fun observeSessionsCompletedToday(): Flow<Int> = flow {
        var lastDay = -1L
        while (currentCoroutineContext().isActive) {
            val today = LocalDate.now().toEpochDay()
            if (today != lastDay) {
                lastDay = today
                completedSessionDao.observeCountByDate(today).collect { emit(it) }
            } else {
                delay(60_000L)
            }
        }
    }

    private fun currentStreak(activeDays: List<Long>): Int {
        if (activeDays.isEmpty()) return 0
        val set = activeDays.toSet()
        val today = LocalDate.now().toEpochDay()
        var streak = 0
        var cursor = when {
            set.contains(today) -> today
            set.contains(today - 1) -> today - 1
            else -> return 0
        }
        while (set.contains(cursor)) {
            streak++
            cursor--
        }
        return streak
    }

    private fun bestStreak(activeDays: List<Long>): Int {
        if (activeDays.isEmpty()) return 0
        val sorted = activeDays.sorted()
        var best = 1
        var run = 1
        for (i in 1 until sorted.size) {
            run = if (sorted[i] == sorted[i - 1] + 1) run + 1 else 1
            if (run > best) best = run
        }
        return best
    }
}
