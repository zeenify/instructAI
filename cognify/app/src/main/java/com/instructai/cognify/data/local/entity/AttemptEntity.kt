package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "attempts",
    foreignKeys = [
        ForeignKey(
            entity = ReviewEntity::class,
            parentColumns = ["id"],
            childColumns = ["review_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("review_id")],
)
data class AttemptEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "attempt_type") val attemptType: String,
    @ColumnInfo(name = "score") val score: Int = 0,
    @ColumnInfo(name = "max_score") val maxScore: Int = 0,
    @ColumnInfo(name = "answers_json") val answersJson: String = "",
    @ColumnInfo(name = "started_at") val startedAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "finished_at") val finishedAt: Long? = null,
    @ColumnInfo(name = "synced") val synced: Boolean = false,
)
