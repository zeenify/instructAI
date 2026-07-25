package com.instructai.cognify.data.repository

import com.instructai.cognify.data.remote.ApiService
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.remote.dto.GoogleLoginRequest
import com.instructai.cognify.data.remote.dto.LoginRequest
import com.instructai.cognify.data.remote.dto.UserDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val apiService: ApiService,
    private val tokenManager: TokenManager,
) {
    private var _currentUser: UserDto? = null
    val currentUser: UserDto? get() = _currentUser

    suspend fun login(email: String, password: String): Result<UserDto> {
        return try {
            val response = apiService.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val body = response.body()
                val token = body?.token
                val user = body?.user
                if (token != null && user != null) {
                    tokenManager.saveToken(token)
                    _currentUser = user
                    Result.success(user)
                } else {
                    Result.failure(Exception("Invalid response"))
                }
            } else {
                Result.failure(Exception("Login failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun loginWithGoogle(idToken: String): Result<UserDto> {
        return try {
            val response = apiService.loginWithGoogle(
                GoogleLoginRequest(idToken = idToken, role = "student")
            )
            if (response.isSuccessful) {
                val body = response.body()
                val token = body?.token
                val user = body?.user
                if (body?.requiresRole == true) {
                    Result.failure(Exception("new_user"))
                } else if (token != null && user != null) {
                    tokenManager.saveToken(token)
                    _currentUser = user
                    Result.success(user)
                } else {
                    Result.failure(Exception("Invalid response"))
                }
            } else {
                Result.failure(Exception("Google login failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun isLoggedIn(): Boolean = tokenManager.hasTokenSync()

    suspend fun logout() {
        try { apiService.logout() } catch (_: Exception) { }
        tokenManager.clearToken()
        _currentUser = null
    }
}
