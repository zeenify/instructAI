package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PracticeQuestionDao {

    @Query("SELECT * FROM practice_questions WHERE review_id = :reviewId ORDER BY order_index")
    fun getQuestionsByReview(reviewId: Long): Flow<List<PracticeQuestionEntity>>

    @Query("SELECT * FROM practice_questions WHERE review_id = :reviewId AND set_id IS :setId ORDER BY order_index")
    fun getQuestionsByReviewAndSet(reviewId: Long, setId: Long?): Flow<List<PracticeQuestionEntity>>

    @Query("SELECT COUNT(*) FROM practice_questions WHERE review_id = :reviewId AND set_id IS :setId")
    suspend fun getCountByReviewAndSet(reviewId: Long, setId: Long?): Int

    @Query("SELECT * FROM practice_questions WHERE id = :id")
    suspend fun getQuestionById(id: Long): PracticeQuestionEntity?

    @Query("SELECT * FROM practice_questions WHERE id IN (:ids) ORDER BY order_index")
    suspend fun getQuestionsByIds(ids: List<Long>): List<PracticeQuestionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(questions: List<PracticeQuestionEntity>)

    @Query("DELETE FROM practice_questions WHERE review_id = :reviewId")
    suspend fun deleteByReview(reviewId: Long)

    @Query("DELETE FROM practice_questions WHERE review_id = :reviewId AND set_id IS :setId")
    suspend fun deleteByReviewAndSet(reviewId: Long, setId: Long?)

    @Query("SELECT COUNT(*) FROM practice_questions WHERE review_id = :reviewId")
    suspend fun getCountByReview(reviewId: Long): Int
}
