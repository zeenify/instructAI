package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(
    tableName = "missed_items",
    foreignKeys = [
        ForeignKey(
            entity = ReviewEntity::class,
            parentColumns = ["id"],
            childColumns = ["review_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    primaryKeys = ["review_id", "item_type", "item_id"],
    indices = [Index("review_id"), Index("review_id", "item_type")],
)
data class MissedItemEntity(
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "item_type") val itemType: String,
    @ColumnInfo(name = "item_id") val itemId: Long,
    @ColumnInfo(name = "missed_at") val missedAt: Long = System.currentTimeMillis(),
) {
    companion object {
        const val TYPE_FLASHCARD = "flashcard"
        const val TYPE_CLOZE = "cloze"
        const val TYPE_PRACTICE = "practice"
    }
}
