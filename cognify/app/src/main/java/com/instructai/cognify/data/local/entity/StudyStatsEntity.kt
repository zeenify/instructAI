package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "study_stats")
data class StudyStatsEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    @ColumnInfo(name = "date_epoch_day")
    val dateEpochDay: Long,
    @ColumnInfo(name = "reviews_created")
    val reviewsCreated: Int = 0,
    @ColumnInfo(name = "flashcards_reviewed")
    val flashcardsReviewed: Int = 0,
    @ColumnInfo(name = "questions_answered")
    val questionsAnswered: Int = 0,
    @ColumnInfo(name = "average_score")
    val averageScore: Float = 0f,
    @ColumnInfo(name = "current_streak")
    val currentStreak: Int = 0,
    @ColumnInfo(name = "study_time_minutes")
    val studyTimeMinutes: Int = 0,
)
