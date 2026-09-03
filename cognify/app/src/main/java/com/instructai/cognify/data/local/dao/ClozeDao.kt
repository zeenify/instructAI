package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.instructai.cognify.data.local.entity.ClozeEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ClozeDao {

    @Query("SELECT * FROM cloze_items WHERE review_id = :reviewId ORDER BY order_index")
    fun getClozeByReview(reviewId: Long): Flow<List<ClozeEntity>>

    @Query("SELECT * FROM cloze_items WHERE review_id = :reviewId AND set_id IS :setId ORDER BY order_index")
    fun getClozeByReviewAndSet(reviewId: Long, setId: Long?): Flow<List<ClozeEntity>>

    @Query("SELECT COUNT(*) FROM cloze_items WHERE review_id = :reviewId AND set_id IS :setId")
    suspend fun getCountByReviewAndSet(reviewId: Long, setId: Long?): Int

    @Query("SELECT * FROM cloze_items WHERE id IN (:ids) ORDER BY order_index")
    suspend fun getClozeItemsByIds(ids: List<Long>): List<ClozeEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<ClozeEntity>)

    @Query("DELETE FROM cloze_items WHERE review_id = :reviewId")
    suspend fun deleteByReview(reviewId: Long)

    @Query("DELETE FROM cloze_items WHERE review_id = :reviewId AND set_id IS :setId")
    suspend fun deleteByReviewAndSet(reviewId: Long, setId: Long?)
}
