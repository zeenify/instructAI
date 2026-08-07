package com.instructai.cognify.data.tts

import android.content.Context
import android.media.MediaMetadataRetriever
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.instructai.cognify.data.local.dao.ReviewTtsDao
import com.instructai.cognify.data.local.dao.TtsClipDao
import com.instructai.cognify.data.local.entity.TtsClipEntity
import com.instructai.cognify.data.local.entity.TtsStatus
import com.instructai.cognify.data.logging.AppLogger
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

private const val KOKORO_VOICE_FEMALE = "kokoro-local-female"
private const val KOKORO_VOICE_MALE = "kokoro-local-male"
private const val RETRY_DELAY_MS = 10_000L

@HiltWorker
class ClipWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val characterVoiceClient: CharacterVoiceClient,
    private val reviewTtsDao: ReviewTtsDao,
    private val ttsClipDao: TtsClipDao,
    private val prototypeTtsEngine: PrototypeTtsEngine,
    private val logger: AppLogger,
) : CoroutineWorker(appContext, workerParams) {

    private data class Payload(
        val reviewId: Long,
        val characterId: String,
        val voiceId: String,
    )

    override suspend fun doWork(): Result {
        val payload = parsePayload() ?: return Result.failure()

        val ttsRow = reviewTtsDao.get(payload.reviewId, payload.characterId) ?: return Result.failure()
        val sentences = TtsJson.sentencesFromJson(ttsRow.sentencesJson)
            .ifEmpty { TtsJson.sentencesFromParagraphs(TtsJson.paragraphsFromJson(ttsRow.paragraphsJson)) }
        if (sentences.isEmpty()) return Result.success()

        val baseDir = File(applicationContext.filesDir, "tts/${payload.reviewId}/${payload.characterId}").apply { mkdirs() }
        val semaphore = Semaphore(2)

        while (true) {
            val existing = ttsClipDao.getClips(payload.reviewId, payload.characterId)
            val pending = sentences.indices.filter { index ->
                val row = existing.firstOrNull { it.sentenceIndex == index }
                !(row?.status == TtsStatus.READY && row.filePath?.let { File(it).exists() } == true)
            }
            if (pending.isEmpty()) return Result.success()

            supervisorScope {
                pending.map { index ->
                    async {
                        semaphore.withPermit {
                            if (isStopped) return@withPermit
                            generateOne(payload, index, sentences[index], baseDir, existing)
                        }
                    }
                }.awaitAll()
            }

            if (isStopped) return Result.retry()
            logger.log("ClipWorker", "clips pending (${pending.size}), retrying in ${RETRY_DELAY_MS}ms")
            delay(RETRY_DELAY_MS)
        }
    }

    private suspend fun generateOne(
        payload: Payload,
        index: Int,
        text: String,
        baseDir: File,
        existing: List<TtsClipEntity>,
    ): Boolean {
        val row = existing.firstOrNull { it.sentenceIndex == index }
        if (row?.status == TtsStatus.READY && row.filePath?.let { File(it).exists() } == true) {
            return true
        }

        val now = System.currentTimeMillis()
        ttsClipDao.upsert(
            TtsClipEntity(payload.reviewId, payload.characterId, index, payload.voiceId, sha1(text), null, null, TtsStatus.GENERATING, now)
        )

        val bytes = if (isKokoroVoice(payload.voiceId)) {
            generateKokoroClip(payload.reviewId, payload.characterId, index, text, payload.voiceId)?.readBytes()
        } else {
            characterVoiceClient.fetchClipBytes(text, payload.voiceId)
        }
        if (bytes != null) {
            val file = File(baseDir, "s$index.mp3")
            file.writeBytes(bytes)
            val durationMs = probeDuration(file)
            ttsClipDao.upsert(
                TtsClipEntity(payload.reviewId, payload.characterId, index, payload.voiceId, sha1(text), file.absolutePath, durationMs, TtsStatus.READY, now)
            )
            logger.log("ClipWorker", "clip ready s$index: ${bytes.size} bytes, ${durationMs ?: "?"}ms")
            return true
        }
        ttsClipDao.upsert(
            TtsClipEntity(payload.reviewId, payload.characterId, index, payload.voiceId, sha1(text), null, null, TtsStatus.ERROR, now)
        )
        logger.log("ClipWorker", "clip failed s$index")
        return false
    }

    private fun probeDuration(file: File): Long? {
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(file.absolutePath)
            val ms = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
            retriever.release()
            ms
        } catch (e: Exception) {
            logger.log("ClipWorker", "duration probe failed for ${file.name}")
            null
        }
    }

    private fun parsePayload(): Payload? {
        return try {
            val raw = inputData.getString("payload") ?: return null
            val obj = JSONObject(raw)
            val reviewId = obj.optLong("review_id", -1L)
            val characterId = obj.optString("character_id", "")
            val voiceId = obj.optString("voice_id", "")
            if (reviewId <= 0 || characterId.isEmpty() || voiceId.isEmpty()) return null
            Payload(reviewId, characterId, voiceId)
        } catch (e: Exception) {
            logger.log("ClipWorker", "parsePayload failed: ${e.message}", e)
            null
        }
    }

    private fun isKokoroVoice(voiceId: String): Boolean =
        voiceId == KOKORO_VOICE_FEMALE || voiceId == KOKORO_VOICE_MALE

    private fun generateKokoroClip(reviewId: Long, characterId: String, index: Int, text: String, voiceId: String): File? {
        return try {
            val dir = File(applicationContext.filesDir, "tts/$reviewId/$characterId").apply { mkdirs() }
            val voice = VoiceLabVoice(
                id = voiceId,
                label = if (voiceId == KOKORO_VOICE_MALE) "Kokoro Male" else "Kokoro Female",
                engine = TtsEngineType.KOKORO,
                sid = if (voiceId == KOKORO_VOICE_MALE) 7 else 0,
            )
            val result = prototypeTtsEngine.generate(applicationContext, voice, text, dir)
            val wav = result.wavPath?.let { File(it) }
            if (wav != null && wav.exists() && result.error == null) wav else null
        } catch (e: Exception) {
            logger.log("ClipWorker", "kokoro clip failed s$index", e)
            null
        }
    }

    private fun sha1(input: String): String {
        val digest = MessageDigest.getInstance("SHA-1").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
