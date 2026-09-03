package com.instructai.cognify.ui.sets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.repository.ReviewerEvent
import com.instructai.cognify.data.repository.ReviewerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReviewSetInfo(
    val id: Long?,
    val name: String,
    val itemCount: Int,
)

data class SetPickerUiState(
    val isLoading: Boolean = true,
    val sets: List<ReviewSetInfo> = emptyList(),
    val isGenerating: Boolean = false,
    val genStatus: String? = null,
    val error: String? = null,
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

    fun start(reviewId: Long, type: String) {
        this.reviewId = reviewId
        this.type = type
        setsJob?.cancel()
        setsJob = viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
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

    fun generateNewSet() {
        val s = _state.value
        if (s.isGenerating) return
        viewModelScope.launch {
            val review = reviewRepository.getReviewById(reviewId) ?: run {
                _state.update { it.copy(error = "Reviewer not found") }
                return@launch
            }
            if (review.contentText.isBlank()) {
                _state.update { it.copy(error = "This reviewer has no source content to generate from") }
                return@launch
            }
            _state.update { it.copy(isGenerating = true, genStatus = "Generating...", error = null) }

            val count = when (type) {
                "flashcards" -> 10
                else -> 5
            }
            val items = mutableListOf<Map<String, Any>>()
            var genError: String? = null

            try {
                reviewerRepository.generateReviewer(
                    review.contentText,
                    review.title,
                    listOf(type),
                    mapOf(type to count),
                    review.difficulty,
                ).collect { event ->
                    when (event) {
                        is ReviewerEvent.Progress -> _state.update { it.copy(genStatus = "Generating...") }
                        is ReviewerEvent.Chunk -> {
                            items += event.items
                            _state.update { it.copy(genStatus = "Generated ${items.size} items...") }
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
                    _state.update { it.copy(isGenerating = false, genStatus = "Set created!") }
                } else {
                    _state.update { it.copy(isGenerating = false, genStatus = null, error = "Failed to create set") }
                }
            } else {
                _state.update { it.copy(isGenerating = false, genStatus = null, error = genError ?: "No items were generated") }
            }
        }
    }

    fun deleteSet(setId: Long) {
        if (setId <= 0L || _state.value.sets.size <= 1) return
        viewModelScope.launch {
            reviewRepository.deleteSet(reviewId, type, setId)
        }
    }

    private fun nextSetName(): String = "Set ${_state.value.sets.size + 1}"
}
