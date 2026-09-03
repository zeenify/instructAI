package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.instructai.cognify.data.local.entity.MissedItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MissedItemDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: MissedItemEntity)

    @Query(
        "DELETE FROM missed_items " +
            "WHERE review_id = :reviewId AND item_type = :itemType AND item_id = :itemId"
    )
    suspend fun remove(reviewId: Long, itemType: String, itemId: Long)

    @Query("SELECT item_id FROM missed_items WHERE review_id = :reviewId AND item_type = :itemType ORDER BY missed_at DESC")
    fun getMissedItemIds(reviewId: Long, itemType: String): Flow<List<Long>>

    @Query("SELECT review_id FROM missed_items GROUP BY review_id ORDER BY MAX(missed_at) DESC")
    fun getMissedReviewIds(): Flow<List<Long>>

    @Query("SELECT COUNT(*) FROM missed_items")
    fun getTotalMissedCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM missed_items WHERE review_id = :reviewId AND item_type = :itemType")
    fun getMissedCountByType(reviewId: Long, itemType: String): Flow<Int>

    @Query("DELETE FROM missed_items WHERE review_id = :reviewId")
    suspend fun deleteByReview(reviewId: Long)
}
