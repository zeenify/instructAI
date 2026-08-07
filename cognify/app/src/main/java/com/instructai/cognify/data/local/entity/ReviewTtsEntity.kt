package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity

object TtsStatus {
    const val GENERATING = "generating"
    const val QUEUED = "queued"
    const val READY = "ready"
    const val ERROR = "error"
}

@Entity(tableName = "review_tts", primaryKeys = ["review_id", "character_id"])
data class ReviewTtsEntity(
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "character_id") val characterId: String,
    @ColumnInfo(name = "paragraphs_json") val paragraphsJson: String,
    @ColumnInfo(name = "sentences_json") val sentencesJson: String = "",
    val status: String,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at") val updatedAt: Long = System.currentTimeMillis(),
)
