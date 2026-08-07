package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "tts_clips",
    primaryKeys = ["review_id", "character_id", "sentence_index", "voice_id"],
    indices = [Index(value = ["review_id", "character_id"])],
)
data class TtsClipEntity(
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "character_id") val characterId: String,
    @ColumnInfo(name = "sentence_index") val sentenceIndex: Int,
    @ColumnInfo(name = "voice_id") val voiceId: String,
    @ColumnInfo(name = "text_hash") val textHash: String = "",
    @ColumnInfo(name = "file_path") val filePath: String? = null,
    @ColumnInfo(name = "duration_ms") val durationMs: Long? = null,
    val status: String,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
)
