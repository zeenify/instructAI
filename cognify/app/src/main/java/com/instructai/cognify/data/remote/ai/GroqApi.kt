package com.instructai.cognify.data.remote.ai

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

data class GroqMessage(
    val role: String,
    val content: String,
)

data class GroqRequest(
    val model: String,
    val messages: List<GroqMessage>,
    val temperature: Double = 0.3,
    val max_tokens: Int = 4096,
    val response_format: Map<String, String> = mapOf("type" to "json_object"),
)

data class GroqChoice(
    val message: GroqMessage,
)

data class GroqResponse(
    val choices: List<GroqChoice>,
)

interface GroqApi {
    @POST("v1/chat/completions")
    suspend fun chatCompletion(
        @Header("Authorization") auth: String,
        @Body request: GroqRequest,
    ): Response<GroqResponse>
}
