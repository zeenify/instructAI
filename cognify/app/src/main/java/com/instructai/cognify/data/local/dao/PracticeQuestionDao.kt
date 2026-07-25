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

    @Query("SELECT * FROM practice_questions WHERE id = :id")
    suspend fun getQuestionById(id: Long): PracticeQuestionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(questions: List<PracticeQuestionEntity>)

    @Query("DELETE FROM practice_questions WHERE review_id = :reviewId")
    suspend fun deleteByReview(reviewId: Long)

    @Query("SELECT COUNT(*) FROM practice_questions WHERE review_id = :reviewId")
    suspend fun getCountByReview(reviewId: Long): Int
}
