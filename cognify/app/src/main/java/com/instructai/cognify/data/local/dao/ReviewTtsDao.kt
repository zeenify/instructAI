package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.instructai.cognify.data.local.entity.ReviewTtsEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ReviewTtsDao {

    @Query("SELECT * FROM review_tts WHERE review_id = :reviewId AND character_id = :characterId")
    fun observe(reviewId: Long, characterId: String): Flow<ReviewTtsEntity?>

    @Query("SELECT * FROM review_tts WHERE review_id = :reviewId AND character_id = :characterId")
    suspend fun get(reviewId: Long, characterId: String): ReviewTtsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ReviewTtsEntity)

    @Query("DELETE FROM review_tts WHERE review_id = :reviewId")
    suspend fun deleteForReview(reviewId: Long)
}
