package com.instructai.cognify.data.repository

import com.instructai.cognify.data.local.dao.ClozeDao
import com.instructai.cognify.data.local.dao.FlashcardDao
import com.instructai.cognify.data.local.dao.MissedItemDao
import com.instructai.cognify.data.local.dao.PracticeQuestionDao
import com.instructai.cognify.data.local.dao.ReviewDao
import com.instructai.cognify.data.local.dao.ReviewSetDao
import com.instructai.cognify.data.local.entity.ClozeEntity
import com.instructai.cognify.data.local.entity.FlashcardEntity
import com.instructai.cognify.data.local.entity.FlashcardReviewEntity
import com.instructai.cognify.data.local.entity.MissedItemEntity
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.data.local.entity.ReviewSetEntity
import com.instructai.cognify.data.logging.AppLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReviewRepository @Inject constructor(
    private val reviewDao: ReviewDao,
    private val reviewSetDao: ReviewSetDao,
    private val flashcardDao: FlashcardDao,
    private val clozeDao: ClozeDao,
    private val practiceQuestionDao: PracticeQuestionDao,
    private val missedItemDao: MissedItemDao,
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

    suspend fun generateFlashcards(
        reviewId: Long,
        flashcards: List<Pair<String, String>>,
        setId: Long? = null,
    ) {
        try {
            if (setId == null) flashcardDao.deleteByReview(reviewId)
            else flashcardDao.deleteByReviewAndSet(reviewId, setId)
            val entities = flashcards.mapIndexed { index, (front, back) ->
                FlashcardEntity(
                    reviewId = reviewId,
                    setId = setId,
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

    suspend fun generateClozeItems(
        reviewId: Long,
        items: List<Triple<String, String, String>>,
        setId: Long? = null,
    ) {
        try {
            if (setId == null) clozeDao.deleteByReview(reviewId)
            else clozeDao.deleteByReviewAndSet(reviewId, setId)
            val entities = items.mapIndexed { index, (before, answer, after) ->
                ClozeEntity(
                    reviewId = reviewId,
                    setId = setId,
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

    suspend fun generatePracticeQuestions(
        reviewId: Long,
        questions: List<PracticeQuestionEntity>,
        setId: Long? = null,
    ) {
        try {
            if (setId == null) practiceQuestionDao.deleteByReview(reviewId)
            else practiceQuestionDao.deleteByReviewAndSet(reviewId, setId)
            val withSet = questions.map { it.copy(setId = setId) }
            practiceQuestionDao.insertAll(withSet)
        } catch (e: Exception) {
            logger.log("ReviewRepository", "generatePracticeQuestions failed for review $reviewId", e)
        }
    }

    suspend fun createSet(reviewId: Long, type: String, name: String): Long? = try {
        reviewSetDao.insert(ReviewSetEntity(reviewId = reviewId, type = type, name = name))
    } catch (e: Exception) {
        logger.log("ReviewRepository", "createSet failed for review $reviewId", e)
        null
    }

    fun getSets(reviewId: Long, type: String): Flow<List<ReviewSetEntity>> =
        reviewSetDao.getSetsByReview(reviewId, type)

    suspend fun getSetCount(reviewId: Long, type: String): Int =
        reviewSetDao.getCountByReview(reviewId, type)

    suspend fun deleteSet(reviewId: Long, type: String, setId: Long) {
        try {
            when (type) {
                "flashcards" -> flashcardDao.deleteByReviewAndSet(reviewId, setId)
                "cloze" -> clozeDao.deleteByReviewAndSet(reviewId, setId)
                "practice" -> practiceQuestionDao.deleteByReviewAndSet(reviewId, setId)
            }
            reviewSetDao.deleteById(setId)
        } catch (e: Exception) {
            logger.log("ReviewRepository", "deleteSet($setId) failed for review $reviewId", e)
        }
    }

    fun getFlashcards(reviewId: Long, setId: Long? = null): Flow<List<FlashcardEntity>> =
        if (setId == null) flashcardDao.getFlashcardsByReview(reviewId)
        else flashcardDao.getFlashcardsByReviewAndSet(reviewId, setId)

    fun getFlashcardReviewDataForReview(reviewId: Long): Flow<List<FlashcardReviewEntity>> =
        flashcardDao.getReviewDataForReview(reviewId)

    fun getDueFlashcards(): Flow<List<FlashcardEntity>> =
        flashcardDao.getDueFlashcards()

    fun getDueCount(): Flow<Int> = flashcardDao.getDueCount()

    fun getNewCount(): Flow<Int> = flashcardDao.getNewCount()

    fun getDueCountsByReview(): Flow<List<com.instructai.cognify.data.local.dao.ReviewDueCount>> =
        flashcardDao.getDueCountsByReview()

    fun dueDeck(reviewId: Long? = null): Flow<List<FlashcardEntity>> =
        if (reviewId != null) flashcardDao.getDueDeckForReview(reviewId)
        else flashcardDao.getDueDeck()

    suspend fun updateFlashcardReview(review: FlashcardReviewEntity) =
        flashcardDao.updateReview(review)

    suspend fun getFlashcardReview(flashcardId: Long): FlashcardReviewEntity? =
        flashcardDao.getReviewByFlashcardId(flashcardId)

    fun getClozeItems(reviewId: Long, setId: Long? = null): Flow<List<ClozeEntity>> =
        if (setId == null) clozeDao.getClozeByReview(reviewId)
        else clozeDao.getClozeByReviewAndSet(reviewId, setId)

    fun getPracticeQuestions(reviewId: Long, setId: Long? = null): Flow<List<PracticeQuestionEntity>> =
        if (setId == null) practiceQuestionDao.getQuestionsByReview(reviewId)
        else practiceQuestionDao.getQuestionsByReviewAndSet(reviewId, setId)

    suspend fun getPracticeQuestionCount(reviewId: Long, setId: Long? = null): Int =
        if (setId == null) practiceQuestionDao.getCountByReview(reviewId)
        else practiceQuestionDao.getCountByReviewAndSet(reviewId, setId)

    suspend fun getItemCount(reviewId: Long, type: String, setId: Long? = null): Int =
        when (type) {
            "flashcards" -> flashcardDao.getCountByReviewAndSet(reviewId, setId)
            "cloze" -> clozeDao.getCountByReviewAndSet(reviewId, setId)
            "practice" -> practiceQuestionDao.getCountByReviewAndSet(reviewId, setId)
            else -> 0
        }

    fun getMissedReviewIds(): Flow<List<Long>> = missedItemDao.getMissedReviewIds()

    fun getTotalMissedCount(): Flow<Int> = missedItemDao.getTotalMissedCount()

    fun getMissedItemIds(reviewId: Long, type: String): Flow<List<Long>> =
        missedItemDao.getMissedItemIds(reviewId, type)

    fun getMissedCountByType(reviewId: Long, type: String): Flow<Int> =
        missedItemDao.getMissedCountByType(reviewId, type)

    suspend fun markMissed(reviewId: Long, type: String, itemId: Long) = try {
        missedItemDao.upsert(MissedItemEntity(reviewId = reviewId, itemType = type, itemId = itemId))
    } catch (e: Exception) {
        logger.log("ReviewRepository", "markMissed($reviewId, $type, $itemId) failed", e)
    }

    suspend fun clearMissed(reviewId: Long, type: String, itemId: Long) = try {
        missedItemDao.remove(reviewId, type, itemId)
    } catch (e: Exception) {
        logger.log("ReviewRepository", "clearMissed($reviewId, $type, $itemId) failed", e)
    }

    suspend fun getMissedFlashcards(reviewId: Long): List<FlashcardEntity> {
        val ids = missedItemDao.getMissedItemIds(reviewId, MissedItemEntity.TYPE_FLASHCARD).first()
        return if (ids.isEmpty()) emptyList() else flashcardDao.getFlashcardsByIds(ids)
    }

    suspend fun getMissedClozeItems(reviewId: Long): List<ClozeEntity> {
        val ids = missedItemDao.getMissedItemIds(reviewId, MissedItemEntity.TYPE_CLOZE).first()
        return if (ids.isEmpty()) emptyList() else clozeDao.getClozeItemsByIds(ids)
    }

    suspend fun getMissedPracticeQuestions(reviewId: Long): List<PracticeQuestionEntity> {
        val ids = missedItemDao.getMissedItemIds(reviewId, MissedItemEntity.TYPE_PRACTICE).first()
        return if (ids.isEmpty()) emptyList() else practiceQuestionDao.getQuestionsByIds(ids)
    }
}
