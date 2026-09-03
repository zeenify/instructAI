package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "flashcards",
    foreignKeys = [
        ForeignKey(
            entity = ReviewEntity::class,
            parentColumns = ["id"],
            childColumns = ["review_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("review_id"), Index("review_id", "set_id")],
)
data class FlashcardEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "set_id") val setId: Long? = null,
    @ColumnInfo(name = "front_text") val frontText: String,
    @ColumnInfo(name = "back_text") val backText: String,
    @ColumnInfo(name = "tags") val tags: String = "",
    @ColumnInfo(name = "difficulty") val difficulty: String = "medium",
    @ColumnInfo(name = "order_index") val orderIndex: Int = 0,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
)
