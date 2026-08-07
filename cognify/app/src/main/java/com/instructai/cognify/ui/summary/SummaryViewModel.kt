package com.instructai.cognify.ui.summary

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.audio.PlayerController
import com.instructai.cognify.audio.PlayerState
import com.instructai.cognify.data.local.dao.ReviewTtsDao
import com.instructai.cognify.data.local.dao.TtsClipDao
import com.instructai.cognify.data.local.entity.ReviewTtsEntity
import com.instructai.cognify.data.local.entity.TtsClipEntity
import com.instructai.cognify.data.local.entity.TtsStatus
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.tts.CharacterVoice
import com.instructai.cognify.data.tts.CharacterVoiceClient
import com.instructai.cognify.data.tts.TtsGenerationManager
import com.instructai.cognify.data.tts.TtsJson
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONArray
import javax.inject.Inject

data class SummarySection(
    val title: String,
    val points: List<String>,
)

enum class SummaryTab { NOTES, READ_ALOUD }

data class SummaryState(
    val sections: List<SummarySection> = emptyList(),
    val isLoading: Boolean = true,
    val reviewTitle: String = "",
    val voices: List<CharacterVoice> = emptyList(),
    val selectedVoiceId: String? = null,
    val transform: ReviewTtsEntity? = null,
    val clips: List<TtsClipEntity> = emptyList(),
    val tab: SummaryTab = SummaryTab.NOTES,
)

@HiltViewModel
class SummaryViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val characterVoiceClient: CharacterVoiceClient,
    private val reviewTtsDao: ReviewTtsDao,
    private val ttsClipDao: TtsClipDao,
    private val ttsGenerationManager: TtsGenerationManager,
    private val playerController: PlayerController,
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(SummaryState())
    val state: StateFlow<SummaryState> = _state.asStateFlow()

    val playerState: StateFlow<PlayerState> = playerController.state

    private var reviewId: Long = -1L
    private var transformJob: Job? = null
    private var clipsJob: Job? = null

    private val characterId: String
        get() = _state.value.selectedVoiceId ?: "system"

    private val needsFallbackTts: Boolean
        get() {
            val id = _state.value.selectedVoiceId
            return id == null || id == COGNI_PLACEHOLDER
        }

    private val shouldGenerateClips: Boolean
        get() = _state.value.selectedVoiceId != null && !needsFallbackTts

    fun loadContent(id: Long) {
        reviewId = id
        viewModelScope.launch {
            try {
                val review = reviewRepository.getReviewById(id)
                val raw = review?.studyGuide?.takeIf { it.isNotBlank() } ?: ""
                val sections = if (raw.isNotBlank()) parseSections(raw) else emptyList()
                val voices = characterVoiceClient.fetchVoices()
                val selectedVoiceId = characterVoiceClient.reviewVoiceId(id).first()
                    ?: characterVoiceClient.defaultVoiceId.first()
                _state.value = _state.value.copy(
                    sections = sections,
                    reviewTitle = review?.title ?: "",
                    isLoading = false,
                    voices = voices,
                    selectedVoiceId = selectedVoiceId,
                )
                observeGeneration()
            } catch (e: Exception) {
                logger.log("SummaryViewModel", "loadContent($id) failed", e)
            }
        }
    }

    fun selectTab(tab: SummaryTab) {
        _state.value = _state.value.copy(tab = tab)
    }

    fun selectVoice(id: Long, voiceId: String?) {
        if (voiceId == _state.value.selectedVoiceId) return
        viewModelScope.launch {
            characterVoiceClient.setReviewVoiceId(id, voiceId)
            if (playerController.isActiveFor(id)) playerController.stop()
            _state.value = _state.value.copy(selectedVoiceId = voiceId)
            observeGeneration()
        }
    }

    fun generateTransform() {
        val s = _state.value
        if (s.sections.isEmpty() || reviewId <= 0) return
        val voiceId = s.selectedVoiceId
        val charId = voiceId ?: "system"
        val persona = characterVoiceClient.personaFor(voiceId)
        val name = characterVoiceClient.voiceName(voiceId)
        val sectionsJson = TtsJson.sectionsToJson(
            s.sections.map { mapOf("title" to it.title, "points" to it.points) }
        )
        val now = System.currentTimeMillis()
        viewModelScope.launch {
            reviewTtsDao.upsert(ReviewTtsEntity(reviewId, charId, "", "", TtsStatus.GENERATING, now, now))
        }
        ttsGenerationManager.enqueueTransform(
            reviewId = reviewId,
            characterId = charId,
            characterName = name,
            personaHint = persona.hint,
            sectionsJson = sectionsJson,
            clipVoiceId = voiceId.takeIf { shouldGenerateClips },
        )
    }

    fun togglePlay(startIndex: Int = 0) {
        val s = _state.value
        val transform = s.transform ?: return
        val sentences = TtsJson.sentencesFromJson(transform.sentencesJson)
            .ifEmpty { TtsJson.sentencesFromParagraphs(TtsJson.paragraphsFromJson(transform.paragraphsJson)) }
        if (sentences.isEmpty()) return
        val p = playerController.state.value
        val charId = s.selectedVoiceId ?: "system"
        val active = p.reviewId == reviewId && p.characterId == charId
        if (active && p.currentIndex >= 0 && p.isPlaying) {
            playerController.pause()
        } else if (active && p.currentIndex >= 0) {
            playerController.resume()
        } else {
            playerController.play(
                reviewId = reviewId,
                characterId = charId,
                characterName = characterVoiceClient.voiceName(s.selectedVoiceId),
                voiceId = s.selectedVoiceId,
                title = s.reviewTitle,
                sentences = sentences,
                startIndex = startIndex,
                fallbackAll = needsFallbackTts,
            )
        }
    }

    fun seekTo(index: Int) = playerController.seekTo(index)

    fun seekToTime(ms: Long) = playerController.seekToTime(ms)

    fun setSpeed(rate: Float) = playerController.setSpeed(rate)

    fun stopPlayer() = playerController.stop()

    fun isPlayerActiveFor(id: Long): Boolean = playerController.isActiveFor(id)

    private fun observeGeneration() {
        if (reviewId <= 0) return
        transformJob?.cancel()
        clipsJob?.cancel()
        val charId = characterId
        transformJob = viewModelScope.launch {
            reviewTtsDao.observe(reviewId, charId).collect { transform ->
                _state.update { it.copy(transform = transform) }
            }
        }
        clipsJob = viewModelScope.launch {
            ttsClipDao.observeClips(reviewId, charId).collect { clips ->
                _state.update { it.copy(clips = clips) }
            }
        }
    }

    private fun parseSections(json: String): List<SummarySection> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                val title = obj.optString("title", "")
                val ptsArr = obj.optJSONArray("points")
                val points = if (ptsArr != null) {
                    (0 until ptsArr.length()).map { ptsArr.optString(it, "") }.filter { it.isNotBlank() }
                } else emptyList()
                SummarySection(title = title, points = points)
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    companion object {
        const val COGNI_PLACEHOLDER = "cogni-placeholder"
    }
}
