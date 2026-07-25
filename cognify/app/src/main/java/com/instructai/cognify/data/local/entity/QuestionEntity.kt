package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "questions",
    foreignKeys = [
        ForeignKey(
            entity = QuizEntity::class,
            parentColumns = ["id"],
            childColumns = ["quiz_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("quiz_id")],
)
data class QuestionEntity(
    @PrimaryKey val id: Long,
    @ColumnInfo(name = "quiz_id") val quizId: Long,
    @ColumnInfo(name = "question_text") val questionText: String,
    val type: String,
    val options: String?,
    val points: Int,
    val boilerplate: String?,
)
