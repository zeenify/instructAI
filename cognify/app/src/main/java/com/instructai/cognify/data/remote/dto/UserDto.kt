package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class UserDto(
    val id: Long,
    val email: String,
    val role: String,
    @SerializedName("studentProfile") val studentProfile: StudentProfileDto?,
    @SerializedName("teacherProfile") val teacherProfile: TeacherProfileDto?,
)

data class StudentProfileDto(
    val id: Long,
    @SerializedName("first_name") val firstName: String,
    @SerializedName("last_name") val lastName: String,
)
