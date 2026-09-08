package com.instructai.cognify.ui.sets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.repository.ReviewerEvent
import com.instructai.cognify.data.repository.ReviewerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReviewSetInfo(
    val id: Long?,
    val name: String,
    val itemCount: Int,
)

/** What the student configures in the New Set sheet. */
data class GenerationOptions(
    val count: Int,
    val difficulty: String,
    val extraPrompt: String = "",
    val avoidUsed: Boolean = true,
)

/** One generated item, streamed into the sheet as it arrives. */
data class GeneratedItemPreview(
    val front: String,
    val back: String,
)

data class SetPickerUiState(
    val isLoading: Boolean = true,
    val sets: List<ReviewSetInfo> = emptyList(),
    val isGenerating: Boolean = false,
    val genStatus: String? = null,
    val error: String? = null,
    val showGenerateSheet: Boolean = false,
    val generationOptions: GenerationOptions? = null,
    val liveItems: List<GeneratedItemPreview> = emptyList(),
    val reviewDifficulty: String = "medium",
    val sourceText: String = "",
)

@HiltViewModel
class SetPickerViewModel @Inject constructor(
    private val reviewRepository: ReviewRepository,
    private val reviewerRepository: ReviewerRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(SetPickerUiState())
    val state: StateFlow<SetPickerUiState> = _state.asStateFlow()

    private var reviewId: Long = -1L
    private var type: String = "flashcards"
    private var setsJob: Job? = null
    private var cachedReview: ReviewEntity? = null

    fun start(reviewId: Long, type: String) {
        this.reviewId = reviewId
        this.type = type
        setsJob?.cancel()
        setsJob = viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val review = reviewRepository.getReviewById(reviewId)
                cachedReview = review
                if (review != null) {
                    _state.update {
                        it.copy(
                            reviewDifficulty = review.difficulty.ifBlank { "medium" },
                            sourceText = review.contentText,
                        )
                    }
                }
                reviewRepository.getSets(reviewId, type).collect { sets ->
                    val namedCounts = sets.associate { set -> set.id to reviewRepository.getItemCount(reviewId, type, set.id) }
                    val defaultCount = reviewRepository.getItemCount(reviewId, type, null)
                    val list = buildList {
                        add(ReviewSetInfo(null, "Set 1", defaultCount))
                        sets.forEach { add(ReviewSetInfo(it.id, it.name, namedCounts[it.id] ?: 0)) }
                    }
                    _state.update { it.copy(isLoading = false, sets = list) }
                }
            } catch (e: Exception) {
                logger.log("SetPickerViewModel", "load sets failed for review $reviewId", e)
                _state.update { it.copy(isLoading = false, error = "Failed to load sets") }
            }
        }
    }

    fun openGenerateSheet() {
        val s = _state.value
        if (s.isGenerating || s.isLoading) return
        val defaultCount = if (type == "flashcards") 10 else 5
        _state.update {
            it.copy(
                showGenerateSheet = true,
                error = null,
                generationOptions = GenerationOptions(
                    count = defaultCount,
                    difficulty = it.reviewDifficulty,
                ),
            )
        }
    }

    /** Dismissal is ignored mid-generation so the live view can't be lost. */
    fun closeGenerateSheet() {
        if (!_state.value.isGenerating) {
            _state.update { it.copy(showGenerateSheet = false) }
        }
    }

    fun updateOptions(transform: (GenerationOptions) -> GenerationOptions) {
        _state.update { s -> s.copy(generationOptions = s.generationOptions?.let(transform)) }
    }

    fun generateNewSet(options: GenerationOptions) {
        val s = _state.value
        if (s.isGenerating) return
        viewModelScope.launch {
            val review = cachedReview ?: reviewRepository.getReviewById(reviewId) ?: run {
                _state.update { it.copy(error = "Reviewer not found") }
                return@launch
            }
            if (review.contentText.isBlank()) {
                _state.update { it.copy(error = "This reviewer has no source content to generate from") }
                return@launch
            }
            _state.update {
                it.copy(isGenerating = true, genStatus = "Preparing…", error = null, liveItems = emptyList())
            }

            val avoid = if (options.avoidUsed) loadUsedItemTexts() else emptyList()
            val items = mutableListOf<Map<String, Any>>()
            var genError: String? = null

            try {
                reviewerRepository.generateReviewer(
                    review.contentText,
                    review.title,
                    listOf(type),
                    mapOf(type to options.count),
                    options.difficulty,
                    extraInstruction = options.extraPrompt.trim().ifBlank { null },
                    avoidItems = avoid,
                ).collect { event ->
                    when (event) {
                        is ReviewerEvent.Progress -> _state.update {
                            it.copy(genStatus = when (event.status) {
                                "preparing" -> "Preparing model…"
                                else -> "Generating…"
                            })
                        }
                        is ReviewerEvent.Chunk -> {
                            items += event.items
                            val previews = event.items.map { it.toPreview() }
                            _state.update { st ->
                                st.copy(
                                    liveItems = st.liveItems + previews,
                                    genStatus = "Generated ${items.size} of ${options.count}…",
                                )
                            }
                        }
                        is ReviewerEvent.Error -> genError = event.message
                        else -> {}
                    }
                }
            } catch (e: Exception) {
                genError = e.message ?: "Generation failed"
                logger.log("SetPickerViewModel", "generateNewSet failed for review $reviewId", e)
            }

            if (items.isNotEmpty()) {
                val setId = reviewRepository.createSet(reviewId, type, nextSetName())
                if (setId != null) {
                    when (type) {
                        "flashcards" -> reviewRepository.generateFlashcards(
                            reviewId,
                            items.map { Pair(it["front"]?.toString() ?: "", it["back"]?.toString() ?: "") },
                            setId,
                        )
                        "practice" -> reviewRepository.generatePracticeQuestions(
                            reviewId,
                            items.map { q ->
                                val questionType = q["type"]?.toString() ?: "multiple_choice"
                                val rawOptions = q["options"]
                                val optionsJson = when {
                                    rawOptions is List<*> && rawOptions.isNotEmpty() -> {
                                        try { org.json.JSONArray(rawOptions).toString() }
                                        catch (_: Exception) { rawOptions.joinToString("|") }
                                    }
                                    questionType == "true_false" -> """["True", "False"]"""
                                    else -> ""
                                }
                                PracticeQuestionEntity(
                                    reviewId = reviewId,
                                    questionType = questionType,
                                    questionText = q["question"]?.toString() ?: "",
                                    options = optionsJson,
                                    correctAnswer = q["correct_answer"]?.toString() ?: "",
                                    explanation = q["explanation"]?.toString() ?: "",
                                )
                            },
                            setId,
                        )
                    }
                } else {
                    _state.update { it.copy(error = "Failed to create set") }
                }
                _state.update {
                    it.copy(
                        isGenerating = false,
                        showGenerateSheet = false,
                        genStatus = null,
                        liveItems = emptyList(),
                    )
                }
            } else {
                _state.update {
                    it.copy(isGenerating = false, error = genError ?: "No items were generated")
                }
            }
        }
    }

    /** Fronts/questions of every item already stored for this review+type. */
    private suspend fun loadUsedItemTexts(): List<String> = try {
        val texts = if (type == "flashcards") {
            reviewRepository.getFlashcards(reviewId).first().map { it.frontText }
        } else {
            reviewRepository.getPracticeQuestions(reviewId).first().map { it.questionText }
        }
        texts.filter { it.isNotBlank() }.distinct().take(60)
    } catch (e: Exception) {
        logger.log("SetPickerViewModel", "load used items failed", e)
        emptyList()
    }

    private fun Map<String, Any>.toPreview(): GeneratedItemPreview = if (type == "flashcards") {
        GeneratedItemPreview(
            front = this["front"]?.toString() ?: "",
            back = this["back"]?.toString() ?: "",
        )
    } else {
        GeneratedItemPreview(
            front = this["question"]?.toString() ?: "",
            back = this["correct_answer"]?.toString() ?: "",
        )
    }

    private fun nextSetName(): String = "Set ${_state.value.sets.size + 1}"

    fun deleteSet(setId: Long) {
        if (setId <= 0L || _state.value.sets.size <= 1) return
        viewModelScope.launch {
            reviewRepository.deleteSet(reviewId, type, setId)
        }
    }
}
