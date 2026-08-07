package com.instructai.cognify.data.repository

import com.instructai.cognify.data.local.dao.UserDao
import com.instructai.cognify.data.local.entity.UserEntity
import com.instructai.cognify.data.logging.AppLogger
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
    private val userDao: UserDao,
    private val logger: AppLogger,
) {
    private var _currentUser: UserDto? = null
    val currentUser: UserDto? get() = _currentUser

    private var _sessionRestored = false

    suspend fun ensureSession() {
        if (_currentUser != null) return
        if (_sessionRestored) return
        _sessionRestored = true
        if (!tokenManager.hasTokenSync()) return
        try {
            val response = apiService.getUser()
            if (response.isSuccessful) {
                _currentUser = response.body()
            } else {
                val cached = userDao.getUser()
                if (cached != null) {
                    _currentUser = UserDto(
                        id = cached.id,
                        email = cached.email,
                        role = cached.role,
                        studentProfile = null,
                        teacherProfile = null,
                    )
                }
            }
        } catch (e: Exception) {
            val cached = userDao.getUser()
            if (cached != null) {
                _currentUser = UserDto(
                    id = cached.id,
                    email = cached.email,
                    role = cached.role,
                    studentProfile = null,
                    teacherProfile = null,
                )
            }
        }
    }

    suspend fun login(email: String, password: String): Result<UserDto> {
        return try {
            val response = apiService.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val body = response.body()
                val token = body?.token
                val user = body?.user
                if (token != null && user != null) {
                    if (user.role == "teacher") {
                        return Result.failure(Exception("Teacher accounts cannot use Cognify. Please use the web app."))
                    }
                    tokenManager.saveToken(token)
                    _currentUser = user
                    cacheUser(user)
                    Result.success(user)
                } else {
                    logger.log("AuthRepository", "Login: Invalid response body (null token/user)")
                    Result.failure(Exception("Invalid response"))
                }
            } else {
                val errorBody = response.errorBody()?.string() ?: "no error body"
                logger.log("AuthRepository", "Login failed: ${response.code()} - $errorBody")
                Result.failure(Exception("Login failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            logger.log("AuthRepository", "Login exception", e)
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
                    if (user.role == "teacher") {
                        return Result.failure(Exception("Teacher accounts cannot use Cognify. Please use the web app."))
                    }
                    tokenManager.saveToken(token)
                    _currentUser = user
                    cacheUser(user)
                    Result.success(user)
                } else {
                    logger.log("AuthRepository", "Google login: Invalid response (null token/user)")
                    Result.failure(Exception("Invalid response"))
                }
            } else {
                val errorBody = response.errorBody()?.string() ?: "no error body"
                logger.log("AuthRepository", "Google login failed: ${response.code()} - $errorBody")
                Result.failure(Exception("Google login failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            logger.log("AuthRepository", "Google login exception", e)
            Result.failure(e)
        }
    }

    suspend fun getUserDisplayName(): String? {
        val u = _currentUser
        val fromProfile = when (u?.role) {
            "student" -> u.studentProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
            else -> u?.teacherProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
        }
        if (fromProfile != null) return fromProfile
        val cached = try { userDao.getUser() } catch (_: Exception) { null }
        return cached?.name ?: u?.email?.substringBefore("@")
    }

    fun isLoggedIn(): Boolean = tokenManager.hasTokenSync()

    suspend fun logout() {
        try { apiService.logout() } catch (e: Exception) { logger.log("AuthRepository", "Logout API call failed", e) }
        tokenManager.clearToken()
        _currentUser = null
        try { userDao.delete() } catch (e: Exception) { logger.log("AuthRepository", "Failed to clear cached user", e) }
    }

    private suspend fun cacheUser(user: UserDto) {
        val name = when (user.role) {
            "student" -> user.studentProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
            else -> user.teacherProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
        }
        try {
            userDao.upsert(UserEntity(
                id = 1L,
                name = name ?: user.email.substringBefore("@"),
                email = user.email,
                role = user.role,
            ))
        } catch (e: Exception) {
            logger.log("AuthRepository", "Failed to cache user", e)
        }
    }
}
