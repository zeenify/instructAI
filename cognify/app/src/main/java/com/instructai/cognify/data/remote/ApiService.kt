package com.instructai.cognify.data.remote

import com.instructai.cognify.data.remote.dto.ClassDetailDto
import com.instructai.cognify.data.remote.dto.ClassDto
import com.instructai.cognify.data.remote.dto.CourseDetailResponse
import com.instructai.cognify.data.remote.dto.GoogleLoginRequest
import com.instructai.cognify.data.remote.dto.LessonResponse
import com.instructai.cognify.data.remote.dto.LoginRequest
import com.instructai.cognify.data.remote.dto.LoginResponse
import com.instructai.cognify.data.remote.dto.QuizResponse
import com.instructai.cognify.data.remote.dto.TtsVoicesResponse
import com.instructai.cognify.data.remote.dto.UserDto
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Streaming

interface ApiService {

    @POST("login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("login/google")
    suspend fun loginWithGoogle(@Body request: GoogleLoginRequest): Response<LoginResponse>

    @POST("logout")
    suspend fun logout(): Response<Unit>

    @GET("user")
    suspend fun getUser(): Response<UserDto>

    @GET("student/classes")
    suspend fun getClasses(): Response<List<ClassDto>>

    @GET("student/classes/{id}")
    suspend fun getClassDetail(@Path("id") id: Long): Response<ClassDetailDto>

    @GET("student/courses/{id}")
    suspend fun getCourseDetail(@Path("id") id: Long): Response<CourseDetailResponse>

    @GET("student/lessons/{id}")
    suspend fun getLesson(@Path("id") id: Long): Response<LessonResponse>

    @GET("student/quizzes/{id}")
    suspend fun getQuiz(@Path("id") id: Long): Response<QuizResponse>

    @POST("student/generate-reviewer")
    suspend fun generateReviewer(
        @Body request: Map<String, @JvmSuppressWildcards Any>,
    ): Response<ResponseBody>

    @POST("student/reviewer/transform-tts")
    suspend fun transformTts(
        @Body request: Map<String, @JvmSuppressWildcards Any>,
    ): Response<ResponseBody>

    @GET("student/tts/voices")
    suspend fun getTtsVoices(): Response<TtsVoicesResponse>

    @Streaming
    @POST("student/tts")
    suspend fun synthesizeTts(
        @Body request: Map<String, @JvmSuppressWildcards Any>,
    ): Response<ResponseBody>
}
