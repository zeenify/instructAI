package com.instructai.cognify.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import dagger.hilt.android.qualifiers.ApplicationContext
import com.instructai.cognify.data.local.entity.FlashcardEntity
import com.instructai.cognify.data.local.entity.FlashcardReviewEntity
import com.instructai.cognify.data.remote.ApiService
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.remote.ai.GroqApi
import com.instructai.cognify.data.remote.ai.GroqMessage
import com.instructai.cognify.data.remote.ai.GroqRequest
import com.instructai.cognify.data.remote.ai.GroqResponse
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import javax.inject.Inject
import javax.inject.Singleton

data class ReviewerItem(
    val type: String,
    val data: Any,
)

data class ReviewerResult(
    val flashcards: List<Map<String, String>> = emptyList(),
    val clozeItems: List<Map<String, String>> = emptyList(),
    val practiceQuestions: List<Map<String, Any>> = emptyList(),
    val summarySections: List<Map<String, Any>> = emptyList(),
)

sealed class ReviewerEvent {
    data class Progress(val type: String, val status: String) : ReviewerEvent()
    data class Chunk(
        val type: String,
        val items: List<Map<String, Any>>,
        val completed: Int,
        val total: Int,
    ) : ReviewerEvent()
    data class Error(val type: String, val message: String) : ReviewerEvent()
    data object Complete : ReviewerEvent()
}

enum class ApiMode { BACKEND, BYOK }

@Singleton
class ReviewerRepository @Inject constructor(
    private val apiService: ApiService,
    private val groqApi: GroqApi,
    private val tokenManager: TokenManager,
    private val reviewRepository: ReviewRepository,
    @ApplicationContext private val context: Context,
) {
    suspend fun extractText(uri: Uri): String = withContext(Dispatchers.IO) {
        val mimeType = context.contentResolver.getType(uri) ?: "text/plain"

        when {
            mimeType == "text/plain" || uri.toString().endsWith(".txt", ignoreCase = true) -> {
                context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText() ?: ""
            }
            mimeType == "application/pdf" || uri.toString().endsWith(".pdf", ignoreCase = true) -> {
                extractPdfText(uri)
            }
            mimeType?.startsWith("image/") == true -> {
                extractImageText(uri)
            }
            else -> {
                val apiMode = tokenManager.apiMode.first()
                if (apiMode == ApiMode.BACKEND) {
                    extractViaBackend(uri)
                } else {
                    throw UnsupportedOperationException(
                        "PPTX/DOCX extraction requires Backend mode. " +
                                "Switch in Settings or paste text directly."
                    )
                }
            }
        }
    }

    private suspend fun extractPdfText(uri: Uri): String = withContext(Dispatchers.IO) {
        PDFBoxResourceLoader.init(context)
        context.contentResolver.openInputStream(uri)?.use { inputStream ->
            PDDocument.load(inputStream).use { document ->
                PDFTextStripper().getText(document)
            }
        } ?: ""
    }

    private suspend fun extractImageText(uri: Uri): String = withContext(Dispatchers.IO) {
        val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext ""
        val bitmap = BitmapFactory.decodeStream(inputStream)
        inputStream.close()
        if (bitmap == null) return@withContext ""

        val image = InputImage.fromBitmap(bitmap, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val result = try {
            Tasks.await(recognizer.process(image))
        } catch (e: Exception) {
            return@withContext ""
        }
        recognizer.close()
        result.text
    }

    private suspend fun extractViaBackend(uri: Uri): String = withContext(Dispatchers.IO) {
        val inputStream = context.contentResolver.openInputStream(uri)
            ?: throw Exception("Cannot read file")
        val bytes = inputStream.readBytes()
        val requestBody = okhttp3.RequestBody.create("application/octet-stream".toMediaTypeOrNull(), bytes)
        val part = MultipartBody.Part.createFormData("file", "file", requestBody)
        val response = apiService.extractText(part)
        if (response.isSuccessful) {
            response.body()?.string() ?: ""
        } else {
            throw Exception("Extraction failed: ${response.code()}")
        }
    }

    fun generateReviewer(
        lessonContent: String,
        lessonTitle: String,
        reviewerTypes: List<String>,
        counts: Map<String, Int>,
        difficulty: String,
    ): Flow<ReviewerEvent> = flow {
        val apiMode = tokenManager.apiMode.first()

        val flow = when (apiMode) {
            ApiMode.BACKEND -> generateViaBackend(
                lessonContent, lessonTitle, reviewerTypes, counts, difficulty
            )
            ApiMode.BYOK -> generateViaGroqDirect(
                lessonContent, lessonTitle, reviewerTypes, counts, difficulty
            )
        }
        flow.collect { emit(it) }
    }.flowOn(Dispatchers.IO)

    private fun generateViaBackend(
        lessonContent: String,
        lessonTitle: String,
        reviewerTypes: List<String>,
        counts: Map<String, Int>,
        difficulty: String,
    ): Flow<ReviewerEvent> = flow {
        val response = apiService.generateReviewer(
            mapOf(
                "lesson_content" to lessonContent,
                "lesson_title" to lessonTitle,
                "reviewer_types" to reviewerTypes,
                "counts" to counts,
                "difficulty" to difficulty,
            )
        )
        if (!response.isSuccessful) {
            emit(ReviewerEvent.Error("api", "Backend error: ${response.code()}"))
            return@flow
        }

        val body = response.body() ?: run {
            emit(ReviewerEvent.Error("api", "Empty response"))
            return@flow
        }

        val reader = BufferedReader(InputStreamReader(body.byteStream()))
        var currentEvent = ""
        var line = reader.readLine()
        while (line != null) {
            when {
                line.startsWith("event: ") -> currentEvent = line.removePrefix("event: ")
                line.startsWith("data: ") -> {
                    val data = line.removePrefix("data: ")
                    when (currentEvent) {
                        "progress" -> {
                            val json = JSONObject(data)
                            emit(ReviewerEvent.Progress(
                                json.getString("type"),
                                json.getString("status"),
                            ))
                        }
                        "chunk" -> {
                            val json = JSONObject(data)
                            val items = jsonArrayToMaps(json.getJSONArray("items"))
                            emit(ReviewerEvent.Chunk(
                                json.getString("type"),
                                items,
                                json.getInt("completed"),
                                json.getInt("total"),
                            ))
                        }
                        "error" -> {
                            val json = JSONObject(data)
                            emit(ReviewerEvent.Error(
                                json.getString("type"),
                                json.optString("error", "Unknown error"),
                            ))
                        }
                        "complete" -> emit(ReviewerEvent.Complete)
                    }
                }
            }
            line = reader.readLine()
        }
    }

    private fun generateViaGroqDirect(
        lessonContent: String,
        lessonTitle: String,
        reviewerTypes: List<String>,
        counts: Map<String, Int>,
        difficulty: String,
    ): Flow<ReviewerEvent> = flow {
        val apiKey = tokenManager.groqApiKey.first()
        if (apiKey.isBlank()) {
            emit(ReviewerEvent.Error("config", "Groq API key not set. Configure in Settings."))
            return@flow
        }

        val completed = mutableListOf<String>()
        val total = reviewerTypes.size

        typeLoop@ for (rtype in reviewerTypes) {
            emit(ReviewerEvent.Progress(rtype, "generating"))

            try {
                val (model, promptTemplate) = getPromptConfig(rtype)
                val count = counts[rtype] ?: getDefaultCount(rtype)
                val prompt = promptTemplate
                    .replace("{title}", lessonTitle)
                    .replace("{content}", lessonContent)
                    .replace("{count}", count.toString())

                val response = groqApi.chatCompletion(
                    auth = "Bearer $apiKey",
                    request = GroqRequest(
                        model = model,
                        messages = listOf(
                            GroqMessage("system", "You are a world-class study material creator. Return ONLY valid JSON. No markdown, no code fences, no explanations."),
                            GroqMessage("user", prompt),
                        ),
                    ),
                )

                if (!response.isSuccessful) {
                    emit(ReviewerEvent.Error(rtype, "Groq error: ${response.code()}"))
                    continue@typeLoop
                }

                val groqResponseBody = response.body()
                if (groqResponseBody == null) {
                    emit(ReviewerEvent.Error(rtype, "Empty Groq response"))
                    continue@typeLoop
                }

                val content = groqResponseBody.choices.firstOrNull()?.message?.content ?: ""
                val items = parseGroqResponseToMaps(content, rtype)
                completed.add(rtype)

                emit(ReviewerEvent.Chunk(rtype, items, completed.size, total))
            } catch (e: Exception) {
                emit(ReviewerEvent.Error(rtype, e.message ?: "Generation failed"))
            }
        }

        emit(ReviewerEvent.Complete)
    }

    private fun getPromptConfig(rtype: String): Pair<String, String> {
        val template = when (rtype) {
            "flashcards" -> FLASHCARD_PROMPT
            "cloze" -> CLOZE_PROMPT
            "practice" -> PRACTICE_PROMPT
            "summary" -> SUMMARY_PROMPT
            else -> FLASHCARD_PROMPT
        }
        val model = if (rtype in listOf("flashcards", "practice")) COMPLEX_MODEL else FAST_MODEL
        return model to template
    }

    private fun getDefaultCount(rtype: String): Int = when (rtype) {
        "flashcards" -> 10
        "cloze" -> 5
        "practice" -> 5
        else -> 1
    }

    suspend fun saveReviewer(
        reviewId: Long,
        result: ReviewerResult,
    ) {
        if (result.flashcards.isNotEmpty()) {
            reviewRepository.generateFlashcards(
                reviewId,
                result.flashcards.map { Pair(it["front"] ?: "", it["back"] ?: "") },
            )
        }
        if (result.clozeItems.isNotEmpty()) {
            reviewRepository.generateClozeItems(
                reviewId,
                result.clozeItems.map {
                    Triple(it["before"] ?: "", it["blank"] ?: "", it["after"] ?: "")
                },
            )
        }
        if (result.practiceQuestions.isNotEmpty()) {
            reviewRepository.generatePracticeQuestions(reviewId, emptyList())
        }
    }

    private fun jsonArrayToMaps(jsonArray: JSONArray): List<Map<String, Any>> {
        val result = mutableListOf<Map<String, Any>>()
        for (i in 0 until jsonArray.length()) {
            val obj = jsonArray.optJSONObject(i)
            if (obj != null) {
                val map = mutableMapOf<String, Any>()
                obj.keys().forEach { key ->
                    val value = obj.get(key)
                    map[key] = when (value) {
                        is JSONArray -> (0 until value.length()).map { value.get(it) }
                        else -> value
                    }
                }
                result.add(map)
            }
        }
        return result
    }

    private fun jsonObjectToMap(obj: JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        obj.keys().forEach { key ->
            map[key] = obj.get(key)
        }
        return map
    }

    private fun parseGroqResponseToMaps(content: String, rtype: String): List<Map<String, Any>> {
        val cleaned = content.trim()
            .removeSurrounding("```json", "```")
            .removeSurrounding("```", "```")
            .trim()

        return try {
            when (rtype) {
                "summary" -> {
                    val obj = JSONObject(cleaned)
                    val sections = obj.optJSONArray("sections")
                    if (sections != null) jsonArrayToMaps(sections) else emptyList()
                }
                else -> {
                    val arr = JSONArray(cleaned)
                    jsonArrayToMaps(arr)
                }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    companion object {
        private const val COMPLEX_MODEL = "openai/gpt-oss-120b"
        private const val FAST_MODEL = "openai/gpt-oss-20b"

        private const val FLASHCARD_PROMPT = """You are a world-class study material creator. Generate high-quality flashcards from the given lesson content.

RULES:
- Each flashcard must test ONE specific concept
- Front: clear, specific question that tests understanding
- Back: precise, complete answer
- Focus on: key concepts, definitions, relationships, comparisons, important details
- NEVER include ambiguous questions or yes/no questions
- ALWAYS ensure the answer is factually accurate based SOLELY on the given content

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} flashcards. Return ONLY a valid JSON array:
[{"front": "Question text here?", "back": "Answer text here."}]"""

        private const val CLOZE_PROMPT = """You are a world-class study material creator. Generate fill-in-the-blank exercises from the given lesson content.

RULES:
- Identify KEY TERMS and IMPORTANT CONCEPTS
- Each blank should be a single important word or short phrase (1-3 words)
- The surrounding text must provide enough context to infer the answer
- Vary the position of the blank

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} cloze items. Return ONLY a valid JSON array:
[{"before": "Text before blank...", "blank": "correctAnswer", "after": "...text after blank."}]"""

        private const val PRACTICE_PROMPT = """You are a world-class assessment creator. Generate practice questions from the given lesson content.

QUESTION TYPES: "multiple_choice" (4 options), "true_false", "short_answer"

RULES:
- Multiple choice distractors should be COMMON MISCONCEPTIONS
- True/false should test understanding of nuances
- Short answer requires synthesis or explanation
- Each question must be answerable based SOLELY on the given content

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} questions. Return ONLY a valid JSON array:
[{"type": "multiple_choice", "question": "?", "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"], "correct_answer": "A) opt1", "explanation": "..."}]"""

        private const val SUMMARY_PROMPT = """You are a world-class study material creator. Create a concise summary of the given lesson content.

RULES:
- Organize into logical sections with clear headings
- Each section should have 3-5 bullet points
- Focus on main concepts, important definitions, key relationships
- Use clear, simple language
- Total length: approximately 20-30% of original

Lesson title: {title}
Lesson content:
{content}

Return ONLY a valid JSON object:
{"sections": [{"title": "Section Heading", "points": ["Point 1", "Point 2"]}]}"""
    }
}
