package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ClassDto(
    val id: Long,
    val name: String,
    @SerializedName("class_code") val classCode: String,
    val description: String?,
    val teacher: TeacherDto?,
    @SerializedName("courses_count") val coursesCount: Int = 0,
    @SerializedName("progress_percent") val progressPercent: Int = 0,
)

data class TeacherDto(
    val id: Long,
    val email: String,
    val role: String,
    @SerializedName("teacherProfile") val teacherProfile: TeacherProfileDto?,
)

data class TeacherProfileDto(
    val id: Long,
    @SerializedName("first_name") val firstName: String,
    @SerializedName("last_name") val lastName: String,
    val organization: String?,
)
