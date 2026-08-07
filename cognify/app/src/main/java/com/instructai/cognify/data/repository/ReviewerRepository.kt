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
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.remote.ApiService
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.remote.ai.GeminiApi
import com.instructai.cognify.data.remote.ai.GeminiContent
import com.instructai.cognify.data.remote.ai.GeminiPart
import com.instructai.cognify.data.remote.ai.GeminiRequest
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.zip.ZipInputStream
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

const val MAX_CONTENT_CHARS = 50_000

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

enum class ApiMode { BACKEND, GEMINI }

@Singleton
class ReviewerRepository @Inject constructor(
    private val apiService: ApiService,
    private val geminiApi: GeminiApi,
    private val tokenManager: TokenManager,
    private val reviewRepository: ReviewRepository,
    private val logger: AppLogger,
    @ApplicationContext private val context: Context,
) {
    suspend fun extractText(uri: Uri): String = withContext(Dispatchers.IO) {
        val mimeType = context.contentResolver.getType(uri) ?: ""
        val fileName = uri.toString()

        val text = when {
            mimeType == "text/plain" || fileName.endsWith(".txt", ignoreCase = true) -> {
                context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText() ?: ""
            }
            mimeType == "application/pdf" || fileName.endsWith(".pdf", ignoreCase = true) -> {
                extractPdfText(uri)
            }
            mimeType.startsWith("image/") -> {
                extractImageText(uri)
            }
            mimeType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx", ignoreCase = true) -> {
                extractDocxText(uri)
            }
            mimeType == "application/vnd.openxmlformats-officedocument.presentationml.presentation" || fileName.endsWith(".pptx", ignoreCase = true) -> {
                extractPptxText(uri)
            }
            else -> throw UnsupportedOperationException("Unsupported file type: $mimeType")
        }

        cleanExtractedText(text).take(MAX_CONTENT_CHARS)
    }

    private fun cleanExtractedText(text: String): String {
        if (text.isBlank()) return text
        val pageNumberRegex = Regex("^\\d{1,4}$")
        val pageOfRegex = Regex("^page\\s+\\d{1,4}(\\s+(of|/)\\s+\\d{1,4})?$", RegexOption.IGNORE_CASE)
        val seen = HashMap<String, Int>()
        val lines = text.lineSequence().mapNotNull { line ->
            val trimmed = line.trim()
            if (trimmed.isEmpty()) return@mapNotNull ""
            if (pageNumberRegex.matches(trimmed)) return@mapNotNull null
            if (pageOfRegex.matches(trimmed)) return@mapNotNull null
            val count = seen[trimmed] ?: 0
            val newCount = count + 1
            seen[trimmed] = newCount
            if (newCount >= 3 && trimmed.length <= 80) null else trimmed
        }
        return lines.joinToString("\n")
    }

    private suspend fun extractPdfText(uri: Uri): String = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext ""
            return@withContext inputStream.use { stream ->
                PDDocument.load(stream).use { document ->
                    val pdfText = PDFTextStripper().getText(document).trim()
                    if (pdfText.length >= 200) return@use pdfText

                    val ocrParts = mutableListOf<String>()
                    val renderer = com.tom_roush.pdfbox.rendering.PDFRenderer(document)
                    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                    for (i in 0 until document.numberOfPages) {
                        try {
                            val bitmap = renderer.renderImageWithDPI(i, 150f)
                            val image = InputImage.fromBitmap(bitmap, 0)
                            val result = Tasks.await(recognizer.process(image))
                            if (result.text.isNotBlank()) ocrParts.add(result.text.trim())
                        } catch (e: Exception) {
                            logger.log("ReviewerRepository", "OCR failed on PDF page ${i + 1}", e)
                        }
                    }
                    recognizer.close()

                    val ocrText = ocrParts.joinToString("\n\n")
                    when {
                        pdfText.isBlank() -> ocrText
                        ocrText.isBlank() -> pdfText
                        else -> pdfText + "\n\n" + ocrText
                    }
                }
            }
        } catch (e: Exception) {
            logger.log("ReviewerRepository", "PDF extraction failed", e)
            ""
        }
    }

    private suspend fun extractImageText(uri: Uri): String = withContext(Dispatchers.IO) {
        val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext ""
        val bitmap = BitmapFactory.decodeStream(inputStream)
        inputStream.close()
        if (bitmap == null) {
            logger.log("ReviewerRepository", "OCR: Failed to decode bitmap from URI: $uri")
            return@withContext ""
        }
        ocrBitmap(bitmap)
    }

    private suspend fun ocrBitmap(bitmap: Bitmap): String = withContext(Dispatchers.IO) {
        val image = InputImage.fromBitmap(bitmap, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val result = try {
            Tasks.await(recognizer.process(image))
        } catch (e: Exception) {
            logger.log("ReviewerRepository", "OCR text recognition failed", e)
            return@withContext ""
        }
        recognizer.close()
        result.text
    }

    private suspend fun extractDocxText(uri: Uri): String = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri)
                ?: throw Exception("Cannot read DOCX file")
            inputStream.use { stream ->
                ZipInputStream(stream).use { zip ->
                    var entry = zip.nextEntry
                    while (entry != null) {
                        if (entry.name == "word/document.xml") {
                            val xml = zip.readBytes().toString(Charsets.UTF_8)
                            return@withContext extractTextFromXml(xml, "w:t")
                        }
                        entry = zip.nextEntry
                    }
                }
            }
            throw Exception("No document content found in DOCX")
        } catch (e: Exception) {
            logger.log("ReviewerRepository", "DOCX extraction failed", e)
            throw Exception("Failed to extract DOCX text: ${e.message}")
        }
    }

    private suspend fun extractPptxText(uri: Uri): String = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri)
                ?: throw Exception("Cannot read PPTX file")
            val result = StringBuilder()
            val imageOcrParts = mutableListOf<String>()
            inputStream.use { stream ->
                ZipInputStream(stream).use { zip ->
                    var entry = zip.nextEntry
                    while (entry != null) {
                        when {
                            entry.name.startsWith("ppt/slides/slide") && entry.name.endsWith(".xml") -> {
                                val xml = zip.readBytes().toString(Charsets.UTF_8)
                                if (result.isNotEmpty()) result.append("\n\n")
                                result.append(extractTextFromXml(xml, "a:t"))
                            }
                            entry.name.startsWith("ppt/media/") -> {
                                val imageBytes = zip.readBytes()
                                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                                if (bitmap != null) {
                                    val text = ocrBitmap(bitmap)
                                    if (text.isNotBlank()) imageOcrParts.add(text)
                                }
                            }
                            else -> zip.readBytes()
                        }
                        entry = zip.nextEntry
                    }
                }
            }
            val slideText = result.toString().trim()
            val ocrText = imageOcrParts.joinToString("\n\n")
            when {
                slideText.isBlank() -> ocrText
                ocrText.isBlank() -> slideText
                else -> slideText + "\n\n" + ocrText
            }
        } catch (e: Exception) {
            logger.log("ReviewerRepository", "PPTX extraction failed", e)
            throw Exception("Failed to extract PPTX text: ${e.message}")
        }
    }

    private fun extractTextFromXml(xml: String, tagName: String): String {
        val result = StringBuilder()
        val regex = Regex("<$tagName[^>]*>([^<]*)</$tagName>")
        for (match in regex.findAll(xml)) {
            val text = match.groupValues[1]
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&#10;", "\n")
                .replace("&#13;", "\r")
            result.append(text).append(' ')
        }
        return result.toString().trim()
    }

    suspend fun transformToTts(
        sections: List<Map<String, Any>>,
        characterName: String,
        personaHint: String,
    ): Result<List<String>> = withContext(Dispatchers.IO) {
        try {
            val mode = tokenManager.apiMode.first()
            val paragraphs = when (mode) {
                ApiMode.GEMINI -> transformViaGeminiDirect(sections, characterName, personaHint)
                ApiMode.BACKEND -> transformViaBackend(sections, characterName, personaHint)
            }
            Result.success(paragraphs)
        } catch (e: Exception) {
            logger.log("ReviewerRepository", "transformToTts failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    private suspend fun transformViaBackend(
        sections: List<Map<String, Any>>,
        characterName: String,
        personaHint: String,
    ): List<String> {
        val response = apiService.transformTts(
            mapOf(
                "sections" to sections,
                "character_name" to characterName,
                "persona_hint" to personaHint,
            )
        )
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: "Unknown error"
            throw Exception("Server error ${response.code()}: $errorBody")
        }
        val raw = response.body()?.string() ?: throw Exception("Empty response from server")
        val json = try {
            JSONObject(raw)
        } catch (e: Exception) {
            throw Exception("Invalid server response")
        }
        val arr = json.optJSONArray("paragraphs") ?: throw Exception("Invalid server response")
        val out = mutableListOf<String>()
        for (i in 0 until arr.length()) {
            val p = arr.optString(i).trim()
            if (p.isNotEmpty()) out.add(p)
        }
        if (out.isEmpty()) throw Exception("Empty paragraphs")
        return out
    }

    private suspend fun transformViaGeminiDirect(
        sections: List<Map<String, Any>>,
        characterName: String,
        personaHint: String,
    ): List<String> {
        val apiKey = tokenManager.directApiKey.first()
        if (apiKey.isBlank()) throw Exception("Gemini API key not set. Configure in Settings.")

        val prompt = TRANSFORM_PROMPT
            .replace("{sections}", JSONArray(sections).toString())
            .replace("{character_name}", characterName)
            .replace("{persona_hint}", personaHint)

        val response = geminiApi.generateContent(
            apiKey = apiKey,
            request = GeminiRequest(
                contents = listOf(GeminiContent(parts = listOf(GeminiPart(text = prompt)))),
                systemInstruction = GeminiContent(parts = listOf(
                    GeminiPart(text = "You are a voice narration writer. Return ONLY valid JSON. No markdown, no code fences, no explanations.")
                )),
            ),
        )

        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: "no error body"
            throw Exception("Gemini error ${response.code()}: ${response.message()} | body=$errorBody")
        }

        val content = response.body()?.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
            ?: throw Exception("Empty Gemini response")

        val cleaned = content.trim()
            .removeSurrounding("```json", "```")
            .removeSurrounding("```", "```")
            .trim()

        val obj = try {
            JSONObject(cleaned)
        } catch (e: Exception) {
            throw Exception("Failed to parse Gemini JSON response")
        }
        val arr = obj.optJSONArray("paragraphs") ?: throw Exception("Failed to parse response")
        val out = mutableListOf<String>()
        for (i in 0 until arr.length()) {
            val p = arr.optString(i).trim()
            if (p.isNotEmpty()) out.add(p)
        }
        if (out.isEmpty()) throw Exception("Empty paragraphs")
        return out
    }

    fun generateReviewer(
        lessonContent: String,
        lessonTitle: String,
        reviewerTypes: List<String>,
        counts: Map<String, Int>,
        difficulty: String,
    ): Flow<ReviewerEvent> = flow {
        val mode = tokenManager.apiMode.first()
        val flow = when (mode) {
            ApiMode.GEMINI -> generateViaGeminiDirect(
                lessonContent, lessonTitle, reviewerTypes, counts, difficulty
            )
            ApiMode.BACKEND -> generateViaBackend(
                lessonContent, lessonTitle, reviewerTypes, counts, difficulty
            )
        }
        flow.collect { emit(it) }
    }.flowOn(Dispatchers.IO)

    private fun generateViaGeminiDirect(
        lessonContent: String,
        lessonTitle: String,
        reviewerTypes: List<String>,
        counts: Map<String, Int>,
        difficulty: String,
    ): Flow<ReviewerEvent> = flow {
        val apiKey = tokenManager.directApiKey.first()
        if (apiKey.isBlank()) {
            val msg = "Gemini API key not set. Configure in Settings."
            logger.log("ReviewerRepository", msg)
            emit(ReviewerEvent.Error("config", msg))
            return@flow
        }

        val contentSize = lessonContent.length
        logger.log("ReviewerRepository", "Starting Gemini generation | title=$lessonTitle | content=${contentSize} chars | types=$reviewerTypes")

        val completed = mutableListOf<String>()
        val total = reviewerTypes.size

        typeLoop@ for (rtype in reviewerTypes) {
            emit(ReviewerEvent.Progress(rtype, "generating"))

            try {
                val promptTemplate = getPromptTemplate(rtype)
                val count = counts[rtype] ?: getDefaultCount(rtype)
                val prompt = promptTemplate
                    .replace("{title}", lessonTitle)
                    .replace("{content}", lessonContent)
                    .replace("{count}", count.toString())

                val response = geminiApi.generateContent(
                    apiKey = apiKey,
                    request = GeminiRequest(
                        contents = listOf(GeminiContent(parts = listOf(GeminiPart(text = prompt)))),
                        systemInstruction = GeminiContent(parts = listOf(
                            GeminiPart(text = "You are a world-class study material creator. Return ONLY valid JSON. No markdown, no code fences, no explanations.\n\nNOISE NOTICE: The lesson content may have been extracted from documents, slides, or OCR and can contain noise — page headers/footers, page numbers, presenter or author names, dates, IDs/registration numbers, signature lines, template/slide-deck text (e.g. 'Thank you', 'Course outline', institution names), and OCR typos. IGNORE all such non-study content. Base your materials ONLY on actual educational content. Correct minor OCR typos using context; skip fragments that are unreadable or clearly administrative/metadata.")
                        )),
                    ),
                )

                if (!response.isSuccessful) {
                    val errorBody = response.errorBody()?.string() ?: "no error body"
                    val msg = "Gemini error ${response.code()}: ${response.message()} | body=$errorBody"
                    logger.log("ReviewerRepository", "[$rtype] $msg | content_size=$contentSize")
                    emit(ReviewerEvent.Error(rtype, msg))
                    continue@typeLoop
                }

                val body = response.body()
                if (body?.candidates.isNullOrEmpty()) {
                    val msg = "Empty Gemini response"
                    logger.log("ReviewerRepository", "[$rtype] $msg")
                    emit(ReviewerEvent.Error(rtype, msg))
                    continue@typeLoop
                }

                val content = body!!.candidates!!.firstOrNull()?.content?.parts?.firstOrNull()?.text ?: ""
                if (content.isBlank()) {
                    val msg = "Gemini returned blank text"
                    logger.log("ReviewerRepository", "[$rtype] $msg")
                    emit(ReviewerEvent.Error(rtype, msg))
                    continue@typeLoop
                }

                val items = parseGroqResponseToMaps(content, rtype)
                if (items.isEmpty()) {
                    val msg = "Failed to parse Gemini JSON response"
                    logger.log("ReviewerRepository", "[$rtype] $msg | raw_content=${content.take(500)}")
                    emit(ReviewerEvent.Error(rtype, msg))
                    continue@typeLoop
                }
                completed.add(rtype)

                emit(ReviewerEvent.Chunk(rtype, items, completed.size, total))
            } catch (e: Exception) {
                val msg = e.message ?: "Generation failed"
                logger.log("ReviewerRepository", "[$rtype] Exception: $msg", e)
                emit(ReviewerEvent.Error(rtype, msg))
            }
        }

        emit(ReviewerEvent.Complete)
    }

    private fun generateViaBackend(
        lessonContent: String,
        lessonTitle: String,
        reviewerTypes: List<String>,
        counts: Map<String, Int>,
        difficulty: String,
    ): Flow<ReviewerEvent> = flow {
        val request = mapOf<String, Any>(
            "lesson_content" to lessonContent,
            "lesson_title" to lessonTitle,
            "reviewer_types" to reviewerTypes,
            "counts" to counts,
            "difficulty" to difficulty,
        )

        val response = apiService.generateReviewer(request)
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: "Unknown error"
            emit(ReviewerEvent.Error("backend", "Server error ${response.code()}: $errorBody"))
            return@flow
        }

        val body = response.body() ?: run {
            emit(ReviewerEvent.Error("backend", "Empty response from server"))
            return@flow
        }

        val raw = body.string()
        val json = try {
            JSONObject(raw)
        } catch (e: Exception) {
            emit(ReviewerEvent.Error("backend", "Invalid server response"))
            return@flow
        }

        val completed = mutableListOf<String>()
        val total = reviewerTypes.size

        for (rtype in reviewerTypes) {
            emit(ReviewerEvent.Progress(rtype, "generating"))
            kotlinx.coroutines.delay(400)

            if (!json.has(rtype)) {
                emit(ReviewerEvent.Error(rtype, "Missing in server response"))
                continue
            }

            val rawItems = json.optJSONArray(rtype)
            if (rawItems == null) {
                emit(ReviewerEvent.Error(rtype, json.optJSONObject(rtype)?.optString("error", "Generation failed") ?: "Generation failed"))
                continue
            }

            val items = jsonArrayToMaps(rawItems)
            if (items.isEmpty()) {
                emit(ReviewerEvent.Error(rtype, "Empty result"))
                continue
            }

            completed.add(rtype)
            emit(ReviewerEvent.Chunk(rtype, items, completed.size, total))
            kotlinx.coroutines.delay(600)
        }

        emit(ReviewerEvent.Complete)
    }

    private fun getPromptTemplate(rtype: String): String = when (rtype) {
        "flashcards" -> FLASHCARD_PROMPT
        "cloze" -> CLOZE_PROMPT
        "practice" -> PRACTICE_PROMPT
        "summary" -> SUMMARY_PROMPT
        else -> FLASHCARD_PROMPT
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
            reviewRepository.generatePracticeQuestions(
                reviewId,
                result.practiceQuestions.map { q ->
                    com.instructai.cognify.data.local.entity.PracticeQuestionEntity(
                        reviewId = reviewId,
                        questionType = q["type"]?.toString() ?: "multiple_choice",
                        questionText = q["question"]?.toString() ?: "",
                        options = (q["options"] as? List<*>)?.joinToString("|") ?: "",
                        correctAnswer = q["correct_answer"]?.toString() ?: "",
                        explanation = q["explanation"]?.toString() ?: "",
                    )
                },
            )
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
            logger.log("ReviewerRepository", "[$rtype] JSON parse failed", e)
            emptyList()
        }
    }

    companion object {
        private const val FLASHCARD_PROMPT = """You are a world-class study material creator. Generate high-quality flashcards from the given lesson content.

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and base flashcards ONLY on the actual educational material.

RULES:
- Each flashcard must test ONE specific concept
- Front: clear, specific question that tests understanding
- Back: CONCISE short answer (1-5 words when possible) — ideal for phone screens
- For definitions: answer can be the term itself or a very short phrase
- For processes: answer should be the key output, not a full sentence
- Focus on: key concepts, definitions, relationships, comparisons, important details
- NEVER include ambiguous questions or yes/no questions
- ALWAYS ensure the answer is factually accurate based SOLELY on the given content

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} flashcards. Return ONLY a valid JSON array:
[{"front": "Question text here?", "back": "Short answer here."}]"""

        private const val CLOZE_PROMPT = """You are a world-class study material creator. Generate fill-in-the-blank exercises from the given lesson content.

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and base cloze items ONLY on the actual educational material.

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

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and base questions ONLY on the actual educational material.

QUESTION TYPES (MUST INCLUDE AT LEAST ONE OF EACH):
- "multiple_choice" (4 options, one correct)
- "true_false" (always provide options: ["True", "False"])
- "identification" (one-word answer, max 3 words, options: empty array)

RULES:
- YOU MUST INCLUDE ALL THREE TYPES: multiple_choice, true_false, and identification
- EVERY question MUST include an "options" field. For true_false: ["True", "False"]. For identification: [].
- Multiple choice distractors should be COMMON MISCONCEPTIONS
- True/false should test understanding of nuances
- Identification requires a ONE-WORD or short-phrase answer (max 3 words)
- Each question must be answerable based SOLELY on the given content

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} questions. YOU MUST distribute across all three types (multiple_choice, true_false, identification). Return ONLY a valid JSON array:
[{"type": "multiple_choice", "question": "?", "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"], "correct_answer": "A) opt1", "explanation": "..."}]"""

        private const val SUMMARY_PROMPT = """You are a world-class study material creator. Create a comprehensive yet scannable summary for mobile review.

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and summarize ONLY the actual educational material.

RULES:
- Organize into 4-8 logical sections covering ALL major topics
- Each section: 5-8 bullet points covering every key concept
- Bullet points should be 10-25 words each — concise but complete
- Cover: core concepts, definitions, relationships, processes, important examples
- Use simple, direct language
- Make it thorough enough that reading the summary replaces reading the full lesson
- Prioritize completeness over brevity — include everything important

Lesson title: {title}
Lesson content:
{content}

Return ONLY a valid JSON object:
{"sections": [{"title": "Section Heading", "points": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"]}]}"""

        private const val TRANSFORM_PROMPT = """You are a voice narration writer. Convert the bulleted study guide below into flowing paragraphs designed to be READ ALOUD by a text-to-speech engine.

RULES:
- Rewrite the bullets into natural, flowing prose paragraphs — NO bullets, NO lists, NO markdown, NO emojis, NO special symbols
- Each paragraph: 2-4 sentences. Split the guide into one paragraph per topic cluster (aim for 10-16 paragraphs max for a full guide)
- Use complete sentences with smooth transitions between ideas
- Keep the educational content ACCURATE and COMPLETE — the listener must not lose any key fact from the bullets
- Spell out numbers, abbreviations, and symbols so they are pronounced correctly (e.g. "3.14" -> "three point one four", "&" -> "and", "%" -> "percent")
- Use short, punchy sentences with natural pause points (commas, periods) so TTS sounds natural
- Keep technical terms and proper nouns as-is
- TONE: Deliver the whole guide IN CHARACTER as {character_name}. {persona_hint}
  - The persona affects WORD CHOICE, energy, and attitude ONLY — never invent facts, never joke away content
  - If the character is "System" or "Kokoro" (or the hint is empty): use a clear, neutral, warm instructional tone

Bulleted study guide:
{sections}

Return ONLY a valid JSON object:
{"paragraphs": ["Paragraph one...", "Paragraph two..."]}"""
    }
}
