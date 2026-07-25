package com.instructai.cognify.data.remote.dto

data class LoginResponse(
    val token: String,
    val user: UserDto,
    val role: String? = null,
    val requiresRole: Boolean? = null,
    val email: String? = null,
)
