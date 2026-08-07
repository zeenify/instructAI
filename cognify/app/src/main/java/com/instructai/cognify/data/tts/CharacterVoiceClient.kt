package com.instructai.cognify.data.tts

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.remote.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.File
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

data class CharacterVoice(
    val id: String,
    val name: String,
    val likes: Int = 0,
    val gainDb: Double = 0.0,
)

data class CharacterPersona(
    val characterName: String,
    val hint: String,
)

private val DEFAULT_VOICE_KEY = stringPreferencesKey("default_character_voice_id")

private val builtinVoices = listOf(
    CharacterVoice(id = "ba9fccd271b24b6aaf7eb58e1f1c858a", name = "Miku Nakano", likes = 16, gainDb = 0.0),
    CharacterVoice(id = "72c3988b410f43c9b0905521135ff010", name = "Marin", likes = 8, gainDb = 0.0),
    CharacterVoice(id = "0c03219a981c4570a1b23a15b4107f30", name = "Makima", likes = 79, gainDb = 16.0),
    CharacterVoice(id = "7e9fe06681074145b0227d3685b3b570", name = "Reze", likes = 41, gainDb = 0.0),
    CharacterVoice(id = "4371047e054b4bd28073cd643f5077ff", name = "Horikita", likes = 3, gainDb = 0.0),
    CharacterVoice(id = "c85fb11f91f84312a4bd16756f298ae2", name = "Gojo", likes = 601, gainDb = 0.0),
    CharacterVoice(id = "b1d5b2071ce3450b8f497cca90b78061", name = "Toji", likes = 132, gainDb = 0.0),
)

private val builtinPersonas = mapOf(
    "ba9fccd271b24b6aaf7eb58e1f1c858a" to CharacterPersona("Miku Nakano", "warm, gentle, slightly shy, encouraging"),
    "72c3988b410f43c9b0905521135ff010" to CharacterPersona("Marin", "energetic, bubbly, casual, hype"),
    "0c03219a981c4570a1b23a15b4107f30" to CharacterPersona("Makima", "calm, controlled, composed, commanding"),
    "7e9fe06681074145b0227d3685b3b570" to CharacterPersona("Reze", "soft-spoken, sweet, wistful"),
    "4371047e054b4bd28073cd643f5077ff" to CharacterPersona("Horikita", "cool, precise, formal, a little blunt"),
    "c85fb11f91f84312a4bd16756f298ae2" to CharacterPersona("Gojo", "confident, playful, teasing"),
    "b1d5b2071ce3450b8f497cca90b78061" to CharacterPersona("Toji", "dry, blunt, no-nonsense, low energy"),
)

@Singleton
class CharacterVoiceClient @Inject constructor(
    private val apiService: ApiService,
    private val dataStore: DataStore<Preferences>,
    private val logger: AppLogger,
    @ApplicationContext private val context: Context,
) {

    val defaultVoiceId: Flow<String?> = dataStore.data.map { prefs ->
        prefs[DEFAULT_VOICE_KEY]
    }

    suspend fun setDefaultVoiceId(id: String?) {
        dataStore.edit { prefs ->
            if (id == null) prefs.remove(DEFAULT_VOICE_KEY)
            else prefs[DEFAULT_VOICE_KEY] = id
        }
    }

    fun reviewVoiceId(reviewId: Long): Flow<String?> = dataStore.data.map { prefs ->
        prefs[stringPreferencesKey("review_voice_$reviewId")]
    }

    suspend fun setReviewVoiceId(reviewId: Long, id: String?) {
        dataStore.edit { prefs ->
            val key = stringPreferencesKey("review_voice_$reviewId")
            if (id == null) prefs.remove(key)
            else prefs[key] = id
        }
    }

    suspend fun fetchVoices(): List<CharacterVoice> = builtinVoices

    fun personaFor(voiceId: String?): CharacterPersona =
        builtinPersonas[voiceId] ?: CharacterPersona("System", "")

    fun voiceName(voiceId: String?): String =
        builtinVoices.firstOrNull { it.id == voiceId }?.name
            ?: when (voiceId) {
                "kokoro-local-female" -> "Kokoro Female"
                "kokoro-local-male" -> "Kokoro Male"
                else -> "System Voice"
            }

    suspend fun fetchClipBytes(text: String, voiceId: String): ByteArray? {
        return try {
            val cacheDir = File(context.cacheDir, "character_voices").apply { mkdirs() }
            val hash = sha1(text.trim() + "|" + voiceId)
            val cacheFile = File(cacheDir, "${voiceId.substring(0, 8)}_$hash.mp3")
            if (cacheFile.exists() && cacheFile.length() > 0) {
                cacheFile.readBytes()
            } else {
                val response = apiService.synthesizeTts(
                    mapOf(
                        "text" to text,
                        "reference_id" to voiceId,
                        "format" to "mp3",
                    )
                )
                if (!response.isSuccessful) {
                    val errorBody = response.errorBody()?.string() ?: ""
                    logger.log("CharacterVoiceClient", "fetchClipBytes failed: HTTP ${response.code()} $errorBody")
                    null
                } else {
                    val bytes = response.body()?.bytes()
                    if (bytes == null || bytes.isEmpty()) {
                        logger.log("CharacterVoiceClient", "fetchClipBytes returned empty body")
                        null
                    } else {
                        logger.log("CharacterVoiceClient", "fetched ${bytes.size} bytes for hash $hash")
                        bytes
                    }
                }
            }
        } catch (e: Exception) {
            logger.log("CharacterVoiceClient", "fetchClipBytes error", e)
            null
        }
    }

    suspend fun synthesize(text: String, voiceId: String): File? {
        return try {
            val cacheDir = File(context.cacheDir, "character_voices").apply { mkdirs() }
            val hash = sha1(text.trim() + "|" + voiceId)
            val cacheFile = File(cacheDir, "${voiceId.substring(0, 8)}_$hash.mp3")
            if (cacheFile.exists() && cacheFile.length() > 0) {
                cacheFile
            } else {
                val response = apiService.synthesizeTts(
                    mapOf(
                        "text" to text,
                        "reference_id" to voiceId,
                        "format" to "mp3",
                    )
                )
                if (!response.isSuccessful) {
                    val errorBody = response.errorBody()?.string() ?: ""
                    logger.log("CharacterVoiceClient", "synthesize failed: HTTP ${response.code()} $errorBody")
                    null
                } else {
                    val body = response.body()
                    if (body == null) {
                        null
                    } else {
                        val bytes = body.bytes()
                        if (bytes.isEmpty()) {
                            logger.log("CharacterVoiceClient", "synthesize returned empty body")
                            null
                        } else {
                            cacheFile.writeBytes(bytes)
                            logger.log("CharacterVoiceClient", "synthesized ${bytes.size} bytes -> ${cacheFile.name}")
                            cacheFile
                        }
                    }
                }
            }
        } catch (e: Exception) {
            logger.log("CharacterVoiceClient", "synthesize error", e)
            null
        }
    }

    suspend fun defaultVoice(): CharacterVoice? {
        val id = defaultVoiceId.first() ?: return null
        return fetchVoices().firstOrNull { it.id == id }
    }

    fun clearCache() {
        val dir = File(context.cacheDir, "character_voices")
        dir.listFiles()?.forEach { it.delete() }
    }

    fun cachedVoiceFiles(): List<File> =
        File(context.cacheDir, "character_voices").listFiles()?.toList() ?: emptyList()

    private fun sha1(input: String): String {
        val digest = MessageDigest.getInstance("SHA-1").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
