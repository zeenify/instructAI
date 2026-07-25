package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.instructai.cognify.data.local.entity.FlashcardEntity
import com.instructai.cognify.data.local.entity.FlashcardReviewEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface FlashcardDao {

    @Query("SELECT * FROM flashcards WHERE review_id = :reviewId ORDER BY order_index")
    fun getFlashcardsByReview(reviewId: Long): Flow<List<FlashcardEntity>>

    @Query("SELECT * FROM flashcards WHERE id = :id")
    suspend fun getFlashcardById(id: Long): FlashcardEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(flashcard: FlashcardEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(flashcards: List<FlashcardEntity>)

    @Update
    suspend fun update(flashcard: FlashcardEntity)

    @Delete
    suspend fun delete(flashcard: FlashcardEntity)

    @Query("DELETE FROM flashcards WHERE review_id = :reviewId")
    suspend fun deleteByReview(reviewId: Long)

    // Flashcard reviews (spaced repetition)

    @Query("SELECT * FROM flashcard_reviews WHERE flashcard_id = :flashcardId")
    suspend fun getReviewByFlashcardId(flashcardId: Long): FlashcardReviewEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReview(review: FlashcardReviewEntity): Long

    @Update
    suspend fun updateReview(review: FlashcardReviewEntity)

    @Query("""
        SELECT f.* FROM flashcards f
        INNER JOIN flashcard_reviews fr ON fr.flashcard_id = f.id
        WHERE fr.next_review_at <= :now
        ORDER BY fr.next_review_at ASC
    """)
    fun getDueFlashcards(now: Long = System.currentTimeMillis()): Flow<List<FlashcardEntity>>

    @Query("""
        SELECT COUNT(*) FROM flashcard_reviews 
        WHERE next_review_at <= :now
    """)
    fun getDueCount(now: Long = System.currentTimeMillis()): Flow<Int>

    @Query("""
        SELECT fr.* FROM flashcard_reviews fr
        INNER JOIN flashcards f ON f.id = fr.flashcard_id
        WHERE f.review_id = :reviewId
    """)
    fun getReviewDataForReview(reviewId: Long): Flow<List<FlashcardReviewEntity>>
}
