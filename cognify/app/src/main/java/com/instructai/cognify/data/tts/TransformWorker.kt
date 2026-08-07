package com.instructai.cognify.data.tts

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.instructai.cognify.data.local.dao.ReviewTtsDao
import com.instructai.cognify.data.local.entity.ReviewTtsEntity
import com.instructai.cognify.data.local.entity.TtsStatus
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewerRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import org.json.JSONArray
import org.json.JSONObject

@HiltWorker
class TransformWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val reviewerRepository: ReviewerRepository,
    private val reviewTtsDao: ReviewTtsDao,
    private val ttsGenerationManager: TtsGenerationManager,
    private val logger: AppLogger,
) : CoroutineWorker(appContext, workerParams) {

    private data class Payload(
        val reviewId: Long,
        val characterId: String,
        val characterName: String,
        val personaHint: String,
        val sectionsJson: String,
        val clipVoiceId: String?,
    )

    override suspend fun doWork(): Result {
        val payload = parsePayload()
        if (payload == null) {
            logger.log("TransformWorker", "invalid payload input")
            return Result.failure()
        }

        val now = System.currentTimeMillis()
        reviewTtsDao.upsert(
            ReviewTtsEntity(
                payload.reviewId, payload.characterId, "",
                "", TtsStatus.GENERATING, now, now
            )
        )
        logger.log(
            "TransformWorker",
            "start review=${payload.reviewId} char=${payload.characterId} sections_len=${payload.sectionsJson.length}"
        )

        val sections = parseSections(payload.sectionsJson)
        return try {
            reviewerRepository.transformToTts(sections, payload.characterName, payload.personaHint).fold(
                onSuccess = { paragraphs ->
                    val sentences = TtsJson.sentencesFromParagraphs(paragraphs)
                    reviewTtsDao.upsert(
                        ReviewTtsEntity(
                            payload.reviewId, payload.characterId,
                            JSONArray(paragraphs).toString(),
                            TtsJson.sentencesToJson(sentences),
                            TtsStatus.READY,
                            now, System.currentTimeMillis(),
                        )
                    )
                    if (payload.clipVoiceId != null) {
                        ttsGenerationManager.enqueueClips(payload.reviewId, payload.characterId, payload.clipVoiceId)
                    }
                    logger.log("TransformWorker", "transform ready: review=${payload.reviewId} char=${payload.characterId} sentences=${sentences.size}")
                    Result.success()
                },
                onFailure = { e -> handleFailure(payload, e, now) },
            )
        } catch (e: Exception) {
            handleFailure(payload, e, now)
        }
    }

    private suspend fun handleFailure(payload: Payload, e: Throwable, startedAt: Long): Result {
        val message = "${e.message ?: ""} ${e.cause?.message ?: ""}"
        if (runAttemptCount < MAX_ATTEMPTS && isTransient(message)) {
            logger.log(
                "TransformWorker",
                "transient failure (${runAttemptCount + 1}/$MAX_ATTEMPTS), will retry: ${e.message}"
            )
            return Result.retry()
        }
        reviewTtsDao.upsert(
            ReviewTtsEntity(
                payload.reviewId, payload.characterId, "",
                "", TtsStatus.ERROR, startedAt, System.currentTimeMillis()
            )
        )
        logger.log("TransformWorker", "transform failed: ${e.message}", e)
        return Result.failure()
    }

    private fun isTransient(message: String): Boolean {
        val m = message.lowercase()
        return m.contains("503") || m.contains("429") ||
            m.contains("unavailable") || m.contains("high demand") ||
            m.contains("resource_exhausted") || m.contains("quota") ||
            m.contains("timeout") || m.contains("timed out") ||
            m.contains("socket") || m.contains("connection") ||
            m.contains("502") || m.contains("504") || m.contains("500")
    }

    companion object {
        private const val MAX_ATTEMPTS = 5
    }

    private fun parsePayload(): Payload? {
        return try {
            val raw = inputData.getString("payload") ?: return null
            val obj = JSONObject(raw)
            val reviewId = obj.optLong("review_id", -1L)
            val characterId = obj.optString("character_id", "")
            val characterName = obj.optString("character_name", "")
            val personaHint = obj.optString("persona_hint", "")
            val sectionsJson = obj.optString("sections_json", "")
            val clipVoiceId = obj.optString("clip_voice_id").takeIf { it.isNotEmpty() && it != "null" }
            if (reviewId <= 0 || characterId.isEmpty() || sectionsJson.isEmpty()) return null
            Payload(reviewId, characterId, characterName, personaHint, sectionsJson, clipVoiceId)
        } catch (e: Exception) {
            logger.log("TransformWorker", "parsePayload failed: ${e.message}", e)
            null
        }
    }

    private fun parseSections(json: String): List<Map<String, Any>> {
        val out = mutableListOf<Map<String, Any>>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val points = mutableListOf<String>()
                val pointsArr = obj.optJSONArray("points")
                if (pointsArr != null) {
                    for (j in 0 until pointsArr.length()) {
                        val p = pointsArr.optString(j).trim()
                        if (p.isNotEmpty()) points.add(p)
                    }
                }
                out.add(mapOf("title" to obj.optString("title"), "points" to points))
            }
        } catch (e: Exception) {
            logger.log("TransformWorker", "parseSections failed", e)
        }
        return out
    }
}
