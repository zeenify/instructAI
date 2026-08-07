package com.instructai.cognify.data.tts

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TtsGenerationManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    fun enqueueTransform(
        reviewId: Long,
        characterId: String,
        characterName: String,
        personaHint: String,
        sectionsJson: String,
        clipVoiceId: String? = null,
    ) {
        val payload = JSONObject()
            .put("review_id", reviewId)
            .put("character_id", characterId)
            .put("character_name", characterName)
            .put("persona_hint", personaHint)
            .put("sections_json", sectionsJson)
            .put("clip_voice_id", clipVoiceId ?: JSONObject.NULL)
            .toString()
        val request = OneTimeWorkRequestBuilder<TransformWorker>()
            .setInputData(workDataOf("payload" to payload))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "transform_${reviewId}_$characterId",
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    fun enqueueClips(reviewId: Long, characterId: String, voiceId: String) {
        val payload = JSONObject()
            .put("review_id", reviewId)
            .put("character_id", characterId)
            .put("voice_id", voiceId)
            .toString()
        val request = OneTimeWorkRequestBuilder<ClipWorker>()
            .setInputData(workDataOf("payload" to payload))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "clips_${reviewId}_$characterId",
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    fun cancelTransform(reviewId: Long, characterId: String) {
        WorkManager.getInstance(context).cancelUniqueWork("transform_${reviewId}_$characterId")
    }

    fun cancelClips(reviewId: Long, characterId: String) {
        WorkManager.getInstance(context).cancelUniqueWork("clips_${reviewId}_$characterId")
    }
}
