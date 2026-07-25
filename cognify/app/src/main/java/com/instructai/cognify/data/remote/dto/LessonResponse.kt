package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class LessonResponse(
    val lesson: LessonDetailDto,
    @SerializedName("class_id") val classId: Long,
    @SerializedName("previous_submissions") val previousSubmissions: List<CodeSubmissionDto>,
)

data class LessonDetailDto(
    val id: Long,
    @SerializedName("module_id") val moduleId: Long,
    val title: String,
    val content: List<Map<String, Any>>?,
    @SerializedName("order_index") val orderIndex: Int,
    @SerializedName("is_published") val isPublished: Boolean,
    @SerializedName("ai_enabled") val aiEnabled: Boolean,
    val module: ModuleBriefDto?,
)

data class ModuleBriefDto(
    val id: Long,
    @SerializedName("course_id") val courseId: Long,
    val title: String,
    @SerializedName("order_index") val orderIndex: Int,
    @SerializedName("is_published") val isPublished: Boolean,
    val course: CourseBriefDto?,
)

data class CourseBriefDto(
    val id: Long,
    @SerializedName("class_id") val classId: Long,
)

data class CodeSubmissionDto(
    val id: Long,
    @SerializedName("lesson_id") val lessonId: Long,
    @SerializedName("block_id") val blockId: String,
    val code: String,
    val output: String?,
    @SerializedName("submitted_at") val submittedAt: String,
)
