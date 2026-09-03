package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.instructai.cognify.data.local.entity.ReviewSetEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ReviewSetDao {

    @Insert
    suspend fun insert(set: ReviewSetEntity): Long

    @Query("SELECT * FROM review_sets WHERE review_id = :reviewId AND type = :type ORDER BY created_at ASC")
    fun getSetsByReview(reviewId: Long, type: String): Flow<List<ReviewSetEntity>>

    @Query("SELECT COUNT(*) FROM review_sets WHERE review_id = :reviewId AND type = :type")
    suspend fun getCountByReview(reviewId: Long, type: String): Int

    @Query("SELECT * FROM review_sets WHERE id = :id")
    suspend fun getById(id: Long): ReviewSetEntity?

    @Query("DELETE FROM review_sets WHERE id = :id")
    suspend fun deleteById(id: Long)
}
