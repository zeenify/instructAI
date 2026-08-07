package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.instructai.cognify.data.local.entity.TtsClipEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TtsClipDao {

    @Query(
        "SELECT * FROM tts_clips WHERE review_id = :reviewId AND character_id = :characterId " +
            "ORDER BY sentence_index ASC"
    )
    fun observeClips(reviewId: Long, characterId: String): Flow<List<TtsClipEntity>>

    @Query(
        "SELECT * FROM tts_clips WHERE review_id = :reviewId AND character_id = :characterId " +
            "ORDER BY sentence_index ASC"
    )
    suspend fun getClips(reviewId: Long, characterId: String): List<TtsClipEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: TtsClipEntity)

    @Query("DELETE FROM tts_clips WHERE review_id = :reviewId AND character_id = :characterId")
    suspend fun deleteForReview(reviewId: Long, characterId: String)

    @Query("DELETE FROM tts_clips WHERE review_id = :reviewId")
    suspend fun deleteAllForReview(reviewId: Long)
}
