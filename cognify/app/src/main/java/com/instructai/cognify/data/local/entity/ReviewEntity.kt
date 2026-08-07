package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "reviews")
data class ReviewEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "course_id") val courseId: Long? = null,
    @ColumnInfo(name = "lesson_id") val lessonId: Long? = null,
    val title: String,
    @ColumnInfo(name = "source_type") val sourceType: String,
    @ColumnInfo(name = "content_text") val contentText: String = "",
    @ColumnInfo(name = "study_guide") val studyGuide: String = "",
    val difficulty: String = "medium",
    val status: String = "ready",
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at") val updatedAt: Long = System.currentTimeMillis(),
)
