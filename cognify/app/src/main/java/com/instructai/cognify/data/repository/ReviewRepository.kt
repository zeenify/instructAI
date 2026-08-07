package com.instructai.cognify.data.repository

import com.instructai.cognify.data.local.dao.ClozeDao
import com.instructai.cognify.data.local.dao.FlashcardDao
import com.instructai.cognify.data.local.dao.PracticeQuestionDao
import com.instructai.cognify.data.local.dao.ReviewDao
import com.instructai.cognify.data.local.entity.ClozeEntity
import com.instructai.cognify.data.local.entity.FlashcardEntity
import com.instructai.cognify.data.local.entity.FlashcardReviewEntity
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.data.logging.AppLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReviewRepository @Inject constructor(
    private val reviewDao: ReviewDao,
    private val flashcardDao: FlashcardDao,
    private val clozeDao: ClozeDao,
    private val practiceQuestionDao: PracticeQuestionDao,
    private val logger: AppLogger,
) {
    private val _pendingHighlight = MutableStateFlow<Long?>(null)
    val pendingHighlight: StateFlow<Long?> = _pendingHighlight.asStateFlow()

    fun setPendingHighlight(reviewId: Long) {
        _pendingHighlight.value = reviewId
    }

    fun clearPendingHighlight() {
        _pendingHighlight.value = null
    }

    fun getAllReviews(): Flow<List<ReviewEntity>> = reviewDao.getAllReviews()

    suspend fun getReviewById(id: Long): ReviewEntity? = reviewDao.getReviewById(id)

    suspend fun createReview(
        title: String,
        sourceType: String,
        courseId: Long? = null,
        lessonId: Long? = null,
        contentText: String = "",
        difficulty: String = "medium",
    ): Long {
        val review = ReviewEntity(
            title = title,
            sourceType = sourceType,
            courseId = courseId,
            lessonId = lessonId,
            contentText = contentText,
            difficulty = difficulty,
        )
        return try {
            reviewDao.insert(review)
        } catch (e: Exception) {
            logger.log("ReviewRepository", "createReview failed: title=$title", e)
            -1L
        }
    }

    suspend fun updateReview(review: ReviewEntity) = try {
        reviewDao.update(review)
    } catch (e: Exception) {
        logger.log("ReviewRepository", "updateReview failed: id=${review.id}", e)
    }

    suspend fun deleteReview(id: Long) = try {
        reviewDao.deleteById(id)
    } catch (e: Exception) {
        logger.log("ReviewRepository", "deleteReview($id) failed", e)
    }

    suspend fun generateFlashcards(reviewId: Long, flashcards: List<Pair<String, String>>) {
        try {
            flashcardDao.deleteByReview(reviewId)
            val entities = flashcards.mapIndexed { index, (front, back) ->
                FlashcardEntity(
                    reviewId = reviewId,
                    frontText = front,
                    backText = back,
                    orderIndex = index,
                )
            }
            flashcardDao.insertAll(entities)
            entities.forEach { entity ->
                flashcardDao.insertReview(
                    FlashcardReviewEntity(flashcardId = entity.id)
                )
            }
        } catch (e: Exception) {
            logger.log("ReviewRepository", "generateFlashcards failed for review $reviewId", e)
        }
    }

    suspend fun generateClozeItems(reviewId: Long, items: List<Triple<String, String, String>>) {
        try {
            clozeDao.deleteByReview(reviewId)
            val entities = items.mapIndexed { index, (before, answer, after) ->
                ClozeEntity(
                    reviewId = reviewId,
                    sentenceBefore = before,
                    blankAnswer = answer,
                    sentenceAfter = after,
                    orderIndex = index,
                )
            }
            clozeDao.insertAll(entities)
        } catch (e: Exception) {
            logger.log("ReviewRepository", "generateClozeItems failed for review $reviewId", e)
        }
    }

    suspend fun generatePracticeQuestions(reviewId: Long, questions: List<PracticeQuestionEntity>) {
        try {
            practiceQuestionDao.deleteByReview(reviewId)
            practiceQuestionDao.insertAll(questions)
        } catch (e: Exception) {
            logger.log("ReviewRepository", "generatePracticeQuestions failed for review $reviewId", e)
        }
    }

    fun getFlashcards(reviewId: Long): Flow<List<FlashcardEntity>> =
        flashcardDao.getFlashcardsByReview(reviewId)

    fun getDueFlashcards(): Flow<List<FlashcardEntity>> =
        flashcardDao.getDueFlashcards()

    fun getDueCount(): Flow<Int> = flashcardDao.getDueCount()

    suspend fun updateFlashcardReview(review: FlashcardReviewEntity) =
        flashcardDao.updateReview(review)

    suspend fun getFlashcardReview(flashcardId: Long): FlashcardReviewEntity? =
        flashcardDao.getReviewByFlashcardId(flashcardId)

    fun getClozeItems(reviewId: Long): Flow<List<ClozeEntity>> =
        clozeDao.getClozeByReview(reviewId)

    fun getPracticeQuestions(reviewId: Long): Flow<List<PracticeQuestionEntity>> =
        practiceQuestionDao.getQuestionsByReview(reviewId)

    suspend fun getPracticeQuestionCount(reviewId: Long): Int =
        practiceQuestionDao.getCountByReview(reviewId)
}
