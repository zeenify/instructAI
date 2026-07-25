package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ClassDetailDto(
    val id: Long,
    val name: String,
    @SerializedName("class_code") val classCode: String,
    val description: String?,
    val teacher: TeacherDto?,
    val courses: List<CourseDto>,
)

data class CourseDto(
    val id: Long,
    @SerializedName("class_id") val classId: Long,
    val title: String,
    val description: String?,
    @SerializedName("is_published") val isPublished: Boolean,
    @SerializedName("is_coding") val isCoding: Boolean,
    @SerializedName("order_index") val orderIndex: Int,
    @SerializedName("progress_percent") val progressPercent: Int = 0,
)
