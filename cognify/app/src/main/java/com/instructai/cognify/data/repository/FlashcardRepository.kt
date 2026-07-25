package com.instructai.cognify.data.repository

import com.instructai.cognify.data.local.dao.FlashcardDao
import com.instructai.cognify.data.local.entity.FlashcardReviewEntity
import com.instructai.cognify.domain.model.SpacedRepetitionEngine
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FlashcardRepository @Inject constructor(
    private val flashcardDao: FlashcardDao,
) {
    suspend fun reviewFlashcard(
        flashcardId: Long,
        quality: Int,
    ): FlashcardReviewEntity {
        val existing = flashcardDao.getReviewByFlashcardId(flashcardId)
        val current = existing ?: FlashcardReviewEntity(flashcardId = flashcardId)

        val result = SpacedRepetitionEngine.calculateReview(
            quality = quality,
            currentEaseFactor = current.easeFactor,
            currentInterval = current.intervalDays,
            currentRepetitions = current.repetitions,
        )

        val updated = current.copy(
            easeFactor = result.easeFactor,
            intervalDays = result.intervalDays,
            repetitions = result.repetitions,
            nextReviewAt = result.nextReviewAt,
            lastReviewedAt = System.currentTimeMillis(),
            synced = false,
        )

        if (existing != null) {
            flashcardDao.updateReview(updated)
        } else {
            flashcardDao.insertReview(updated)
        }

        return updated
    }
}
