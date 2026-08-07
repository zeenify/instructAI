package com.instructai.cognify.data.remote.ai

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

data class GeminiContent(
    val parts: List<GeminiPart>,
)

data class GeminiPart(
    val text: String,
)

data class GeminiRequest(
    val contents: List<GeminiContent>,
    val systemInstruction: GeminiContent? = null,
    val generationConfig: GeminiGenerationConfig = GeminiGenerationConfig(),
)

data class GeminiGenerationConfig(
    val temperature: Double = 0.3,
    val maxOutputTokens: Int = 4096,
    val responseMimeType: String = "application/json",
)

data class GeminiResponse(
    val candidates: List<GeminiCandidate>? = null,
)

data class GeminiCandidate(
    val content: GeminiContent? = null,
    val finishReason: String? = null,
)

interface GeminiApi {
    @POST("v1/models/gemini-3.5-flash-lite:generateContent")
    suspend fun generateContent(
        @Header("X-Goog-Api-Key") apiKey: String,
        @Body request: GeminiRequest,
    ): Response<GeminiResponse>
}
