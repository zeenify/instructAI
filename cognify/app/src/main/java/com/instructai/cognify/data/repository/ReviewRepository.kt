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
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReviewRepository @Inject constructor(
    private val reviewDao: ReviewDao,
    private val flashcardDao: FlashcardDao,
    private val clozeDao: ClozeDao,
    private val practiceQuestionDao: PracticeQuestionDao,
) {
    fun getAllReviews(): Flow<List<ReviewEntity>> = reviewDao.getAllReviews()

    suspend fun getReviewById(id: Long): ReviewEntity? = reviewDao.getReviewById(id)

    suspend fun createReview(
        title: String,
        sourceType: String,
        courseId: Long? = null,
        lessonId: Long? = null,
        contentText: String = "",
    ): Long {
        val review = ReviewEntity(
            title = title,
            sourceType = sourceType,
            courseId = courseId,
            lessonId = lessonId,
            contentText = contentText,
        )
        return reviewDao.insert(review)
    }

    suspend fun deleteReview(id: Long) = reviewDao.deleteById(id)

    suspend fun generateFlashcards(reviewId: Long, flashcards: List<Pair<String, String>>) {
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
    }

    suspend fun generateClozeItems(reviewId: Long, items: List<Triple<String, String, String>>) {
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
    }

    suspend fun generatePracticeQuestions(reviewId: Long, questions: List<PracticeQuestionEntity>) {
        practiceQuestionDao.deleteByReview(reviewId)
        practiceQuestionDao.insertAll(questions)
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
