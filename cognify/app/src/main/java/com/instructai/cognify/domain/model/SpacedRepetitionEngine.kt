package com.instructai.cognify.domain.model

import java.util.concurrent.TimeUnit

object SpacedRepetitionEngine {

    private const val MIN_EASE_FACTOR = 1.3f
    private const val EASY_BONUS = 0.15f
    private const val HARD_PENALTY = 0.15f

    data class ReviewResult(
        val easeFactor: Float,
        val intervalDays: Int,
        val repetitions: Int,
        val nextReviewAt: Long,
    )

    fun calculateReview(
        quality: Int,
        currentEaseFactor: Float = 2.5f,
        currentInterval: Int = 0,
        currentRepetitions: Int = 0,
    ): ReviewResult {
        val newEaseFactor = when {
            quality >= 3 -> currentEaseFactor + EASY_BONUS
            quality == 2 -> currentEaseFactor
            else -> (currentEaseFactor - HARD_PENALTY).coerceAtLeast(MIN_EASE_FACTOR)
        }

        val (newInterval, newRepetitions) = when {
            quality < 3 -> {
                resetInterval(quality)
            }
            currentRepetitions == 0 -> {
                1 to 1
            }
            currentRepetitions == 1 -> {
                3 to 2
            }
            else -> {
                (currentInterval * newEaseFactor).toInt() to (currentRepetitions + 1)
            }
        }

        val cappedInterval = newInterval.coerceAtMost(365)

        val nextReviewAt = System.currentTimeMillis() + TimeUnit.DAYS.toMillis(cappedInterval.toLong())

        return ReviewResult(
            easeFactor = newEaseFactor,
            intervalDays = cappedInterval,
            repetitions = newRepetitions,
            nextReviewAt = nextReviewAt,
        )
    }

    private fun resetInterval(quality: Int): Pair<Int, Int> {
        return when (quality) {
            1 -> 1 to 0
            0 -> 0 to 0
            else -> 0 to 0
        }
    }
}
