package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "quizzes",
    foreignKeys = [
        ForeignKey(
            entity = ModuleEntity::class,
            parentColumns = ["id"],
            childColumns = ["module_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("module_id")],
)
data class QuizEntity(
    @PrimaryKey val id: Long,
    @ColumnInfo(name = "module_id") val moduleId: Long,
    val title: String,
    @ColumnInfo(name = "is_randomized") val isRandomized: Boolean,
    @ColumnInfo(name = "time_limit_minutes") val timeLimitMinutes: Int?,
    @ColumnInfo(name = "order_index") val orderIndex: Int,
    @ColumnInfo(name = "passing_score") val passingScore: Int,
    @ColumnInfo(name = "is_published") val isPublished: Boolean,
    @ColumnInfo(name = "timer_mode") val timerMode: String,
    @ColumnInfo(name = "question_limit") val questionLimit: Int?,
    @ColumnInfo(name = "synced_at") val syncedAt: Long = System.currentTimeMillis(),
)
