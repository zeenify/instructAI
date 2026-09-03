package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity

@Entity(
    tableName = "completed_sessions",
    primaryKeys = ["review_id", "type", "set_id", "date_epoch_day"],
)
data class CompletedSessionEntity(
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "type") val type: String,
    @ColumnInfo(name = "set_id") val setId: Long = NO_SET,
    @ColumnInfo(name = "date_epoch_day") val dateEpochDay: Long,
    @ColumnInfo(name = "completed_at") val completedAt: Long = System.currentTimeMillis(),
) {
    companion object {
        const val NO_SET = -1L
        const val TYPE_FLASHCARD = "flashcard"
        const val TYPE_PRACTICE = "practice"
    }
}
