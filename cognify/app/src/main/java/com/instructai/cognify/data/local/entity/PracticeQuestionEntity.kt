package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "practice_questions",
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
data class PracticeQuestionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "question_type") val questionType: String,
    @ColumnInfo(name = "question_text") val questionText: String,
    @ColumnInfo(name = "options") val options: String = "",
    @ColumnInfo(name = "correct_answer") val correctAnswer: String,
    @ColumnInfo(name = "explanation") val explanation: String = "",
    @ColumnInfo(name = "order_index") val orderIndex: Int = 0,
)
