package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class CourseDetailResponse(
    val course: CourseDetailDto,
    @SerializedName("completed_lessons") val completedLessons: List<Long>,
    @SerializedName("completed_quizzes") val completedQuizzes: List<Long>,
)

data class CourseDetailDto(
    val id: Long,
    @SerializedName("class_id") val classId: Long,
    val title: String,
    val description: String?,
    @SerializedName("is_published") val isPublished: Boolean,
    @SerializedName("is_coding") val isCoding: Boolean,
    @SerializedName("order_index") val orderIndex: Int,
    val modules: List<ModuleDto>,
)

data class ModuleDto(
    val id: Long,
    @SerializedName("course_id") val courseId: Long,
    val title: String,
    @SerializedName("order_index") val orderIndex: Int,
    @SerializedName("is_published") val isPublished: Boolean,
    val lessons: List<LessonDto>,
    val quizzes: List<QuizDto>,
)

data class LessonDto(
    val id: Long,
    @SerializedName("module_id") val moduleId: Long,
    val title: String,
    val content: List<Map<String, Any>>?,
    @SerializedName("order_index") val orderIndex: Int,
    @SerializedName("is_published") val isPublished: Boolean,
    @SerializedName("ai_enabled") val aiEnabled: Boolean,
)

data class QuizDto(
    val id: Long,
    @SerializedName("module_id") val moduleId: Long,
    val title: String,
    @SerializedName("is_randomized") val isRandomized: Boolean,
    @SerializedName("ai_enabled") val aiEnabled: Boolean,
    @SerializedName("time_limit_minutes") val timeLimitMinutes: Int?,
    @SerializedName("order_index") val orderIndex: Int,
    @SerializedName("passing_score") val passingScore: Int,
    @SerializedName("is_published") val isPublished: Boolean,
    @SerializedName("timer_mode") val timerMode: String,
    @SerializedName("question_limit") val questionLimit: Int?,
)
