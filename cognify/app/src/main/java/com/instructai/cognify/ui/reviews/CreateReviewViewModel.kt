package com.instructai.cognify.ui.reviews

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.LessonEntity
import com.instructai.cognify.data.local.entity.ModuleEntity
import com.instructai.cognify.data.repository.LmsRepository
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.repository.ReviewerEvent
import com.instructai.cognify.data.repository.ReviewerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import javax.inject.Inject

enum class SourceTab { MODULES, FILE, TEXT }

data class ReviewerTypeConfig(
    val enabled: Boolean = true,
    val count: Int = 10,
)

data class ModuleTreeNode(
    val module: ModuleEntity,
    val lessons: List<LessonEntity>,
    val selectedLessonIds: Set<Long> = emptySet(),
)

data class PhotoItem(
    val uri: Uri,
    val ocrText: String = "",
    val isProcessing: Boolean = false,
    val fileName: String = "",
)

data class ReviewCreationState(
    val sourceTab: SourceTab = SourceTab.MODULES,
    val moduleTrees: List<ModuleTreeNode> = emptyList(),
    val selectedFileUri: Uri? = null,
    val selectedFileName: String = "",
    val pastedText: String = "",
    val photos: List<PhotoItem> = emptyList(),
    val extractedText: String = "",
    val isExtracting: Boolean = false,
    val flashcardEnabled: Boolean = true,
    val flashcardCount: Int = 10,
    val clozeEnabled: Boolean = true,
    val clozeCount: Int = 5,
    val practiceEnabled: Boolean = true,
    val practiceCount: Int = 5,
    val summaryEnabled: Boolean = true,
    val difficulty: String = "medium",
    val isGenerating: Boolean = false,
    val generationProgress: List<GenProgressItem> = emptyList(),
    val generationResult: ReviewerResultState? = null,
    val error: String? = null,
)

data class GenProgressItem(
    val type: String,
    val status: String,
    val itemsCount: Int = 0,
)

data class ReviewerResultState(
    val flashcards: List<Map<String, String>> = emptyList(),
    val clozeItems: List<Map<String, String>> = emptyList(),
    val practiceQuestions: List<Map<String, Any>> = emptyList(),
    val summarySections: List<Map<String, Any>> = emptyList(),
)

@HiltViewModel
class CreateReviewViewModel @Inject constructor(
    private val lmsRepository: LmsRepository,
    private val reviewRepository: ReviewRepository,
    private val reviewerRepository: ReviewerRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ReviewCreationState())
    val state: StateFlow<ReviewCreationState> = _state.asStateFlow()

    init {
        loadModules()
    }

    private fun loadModules() {
        viewModelScope.launch {
            val classes = lmsRepository.getCachedClasses().first()
            val trees = mutableListOf<ModuleTreeNode>()
            for (cls in classes) {
                val courses = lmsRepository.getCachedCourses(cls.id).first()
                for (course in courses) {
                    val modules = lmsRepository.getCachedModules(course.id).first()
                    for (module in modules) {
                        val lessons = lmsRepository.getCachedLessons(module.id).first()
                        trees.add(ModuleTreeNode(module = module, lessons = lessons))
                    }
                }
            }
            _state.update { it.copy(moduleTrees = trees) }
        }
    }

    fun setSourceTab(tab: SourceTab) {
        _state.update { it.copy(sourceTab = tab) }
    }

    fun toggleLesson(moduleIndex: Int, lessonId: Long) {
        _state.update { state ->
            val trees = state.moduleTrees.toMutableList()
            val tree = trees[moduleIndex]
            val selected = tree.selectedLessonIds.toMutableSet()
            if (selected.contains(lessonId)) selected.remove(lessonId) else selected.add(lessonId)
            trees[moduleIndex] = tree.copy(selectedLessonIds = selected)
            state.copy(moduleTrees = trees)
        }
    }

    fun selectAllInModule(moduleIndex: Int) {
        _state.update { state ->
            val trees = state.moduleTrees.toMutableList()
            val tree = trees[moduleIndex]
            val allIds = tree.lessons.map { it.id }.toSet()
            val selected = if (tree.selectedLessonIds.containsAll(allIds)) emptySet() else allIds
            trees[moduleIndex] = tree.copy(selectedLessonIds = selected)
            state.copy(moduleTrees = trees)
        }
    }

    fun setFile(uri: Uri, fileName: String) {
        _state.update { it.copy(selectedFileUri = uri, selectedFileName = fileName, extractedText = "") }
    }

    fun setPastedText(text: String) {
        _state.update { it.copy(pastedText = text) }
    }

    fun addPhoto(uri: Uri, fileName: String) {
        val existing = _state.value.photos.any { it.uri == uri }
        if (existing) return
        val item = PhotoItem(uri = uri, isProcessing = true, fileName = fileName)
        _state.update { it.copy(photos = it.photos + item) }
        viewModelScope.launch {
            try {
                val text = reviewerRepository.extractText(uri)
                _state.update { s ->
                    s.copy(photos = s.photos.map { p ->
                        if (p.uri == uri) p.copy(ocrText = text, isProcessing = false) else p
                    })
                }
            } catch (e: Exception) {
                _state.update { s ->
                    s.copy(photos = s.photos.filter { it.uri != uri })
                }
            }
        }
    }

    fun removePhoto(index: Int) {
        _state.update { it.copy(photos = it.photos.toMutableList().apply { removeAt(index) }) }
    }

    fun setDifficulty(d: String) {
        _state.update { it.copy(difficulty = d) }
    }

    fun toggleFlashcard() { _state.update { it.copy(flashcardEnabled = !it.flashcardEnabled) } }
    fun toggleCloze() { _state.update { it.copy(clozeEnabled = !it.clozeEnabled) } }
    fun togglePractice() { _state.update { it.copy(practiceEnabled = !it.practiceEnabled) } }
    fun toggleSummary() { _state.update { it.copy(summaryEnabled = !it.summaryEnabled) } }
    fun setFlashcardCount(c: Int) { _state.update { it.copy(flashcardCount = c) } }
    fun setClozeCount(c: Int) { _state.update { it.copy(clozeCount = c) } }
    fun setPracticeCount(c: Int) { _state.update { it.copy(practiceCount = c) } }

    fun extractFileContent() {
        val uri = _state.value.selectedFileUri ?: return
        viewModelScope.launch {
            _state.update { it.copy(isExtracting = true, error = null) }
            try {
                val text = reviewerRepository.extractText(uri)
                _state.update { it.copy(extractedText = text, isExtracting = false) }
            } catch (e: Exception) {
                _state.update { it.copy(isExtracting = false, error = e.message) }
            }
        }
    }

    fun generate() {
        val s = _state.value
        val content = resolveContent(s) ?: return
        val title = resolveTitle(s)
        val types = buildReviewerTypes(s)
        val counts = buildCounts(s)

        viewModelScope.launch {
            _state.update { it.copy(isGenerating = true, generationProgress = emptyList(), generationResult = null, error = null) }

            val progressItems = mutableListOf<GenProgressItem>()
            var result = ReviewerResultState()

            reviewerRepository.generateReviewer(content, title, types, counts, s.difficulty)
                .collect { event ->
                    when (event) {
                        is ReviewerEvent.Progress -> {
                            progressItems.add(GenProgressItem(event.type, event.status))
                            _state.update { it.copy(generationProgress = progressItems.toList()) }
                        }
                        is ReviewerEvent.Chunk -> {
                            val idx = progressItems.indexOfFirst { it.type == event.type }
                            if (idx >= 0) {
                                progressItems[idx] = progressItems[idx].copy(
                                    status = "done",
                                    itemsCount = event.items.size,
                                )
                            }
                            result = parseChunkIntoResult(result, event)
                            _state.update { it.copy(
                                generationProgress = progressItems.toList(),
                                generationResult = result,
                            )}
                        }
                        is ReviewerEvent.Error -> {
                            progressItems.add(GenProgressItem(event.type, "error: ${event.message}"))
                            _state.update { it.copy(generationProgress = progressItems.toList(), error = event.message) }
                        }
                        is ReviewerEvent.Complete -> {
                            _state.update { it.copy(isGenerating = false) }
                        }
                    }
                }
        }
    }

    fun regenerate() {
        generate()
    }

    suspend fun saveReview(title: String): Long {
        val s = _state.value
        val result = s.generationResult ?: return -1
        val content = resolveContent(s) ?: ""
        val reviewId = reviewRepository.createReview(
            title = title,
            sourceType = "ai_generated",
            contentText = content.take(500),
        )

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
        if (result.summarySections.isNotEmpty()) {
            reviewRepository.createReview(
                title = "$title - Summary",
                sourceType = "ai_summary",
                contentText = result.summarySections.joinToString("\n") { section ->
                    val sectionTitle = section["title"]?.toString() ?: ""
                    val points = (section["points"] as? List<*>)?.joinToString("\n- ") { "- $it" } ?: ""
                    "$sectionTitle\n$points"
                },
            )
        }

        return reviewId
    }

    private fun resolveContent(state: ReviewCreationState): String? {
        return when (state.sourceTab) {
            SourceTab.MODULES -> {
                val lessonIds = state.moduleTrees.flatMap { it.selectedLessonIds.toList() }
                if (lessonIds.isEmpty()) {
                    _state.update { it.copy(error = "Select at least one lesson") }
                    return null
                }
                val content = lessonIds.mapNotNull { id ->
                    val lesson = state.moduleTrees
                        .flatMap { it.lessons }
                        .find { it.id == id }
                    lesson?.let { "${it.title}\n${it.content}" }
                }.joinToString("\n\n---\n\n")
                if (content.isBlank()) {
                    _state.update { it.copy(error = "Selected lessons have no content") }
                    return null
                }
                content
            }
            SourceTab.FILE -> {
                if (state.extractedText.isBlank()) {
                    _state.update { it.copy(error = "Extract file text first") }
                    return null
                }
                state.extractedText
            }
            SourceTab.TEXT -> {
                val parts = mutableListOf<String>()
                if (state.pastedText.isNotBlank()) parts.add(state.pastedText)
                val photoTexts = state.photos
                    .map { it.ocrText }
                    .filter { it.isNotBlank() }
                parts.addAll(photoTexts)
                if (parts.isEmpty()) {
                    _state.update { it.copy(error = "Add some text or photos first") }
                    return null
                }
                parts.joinToString("\n\n---\n\n")
            }
        }
    }

    private fun resolveTitle(state: ReviewCreationState): String {
        return when (state.sourceTab) {
            SourceTab.MODULES -> {
                val lessonIds = state.moduleTrees.flatMap { it.selectedLessonIds.toList() }
                val lesson = state.moduleTrees.flatMap { it.lessons }.find { it.id == lessonIds.firstOrNull() }
                lesson?.title ?: "Selected Lessons"
            }
            SourceTab.FILE -> state.selectedFileName
            SourceTab.TEXT -> "Pasted Text"
        }
    }

    private fun buildReviewerTypes(state: ReviewCreationState): List<String> {
        return buildList {
            if (state.flashcardEnabled) add("flashcards")
            if (state.clozeEnabled) add("cloze")
            if (state.practiceEnabled) add("practice")
            if (state.summaryEnabled) add("summary")
        }
    }

    private fun buildCounts(state: ReviewCreationState): Map<String, Int> {
        return mapOf(
            "flashcards" to state.flashcardCount,
            "cloze" to state.clozeCount,
            "practice" to state.practiceCount,
        )
    }

    private fun parseChunkIntoResult(
        current: ReviewerResultState,
        event: ReviewerEvent.Chunk,
    ): ReviewerResultState {
        return when (event.type) {
            "flashcards" -> {
                val items = event.items.mapNotNull {
                    it as? Map<*, *>
                }.map {
                    mapOf("front" to (it["front"]?.toString() ?: ""), "back" to (it["back"]?.toString() ?: ""))
                }
                current.copy(flashcards = current.flashcards + items)
            }
            "cloze" -> {
                val items = event.items.mapNotNull {
                    it as? Map<*, *>
                }.map {
                    mapOf(
                        "before" to (it["before"]?.toString() ?: ""),
                        "blank" to (it["blank"]?.toString() ?: ""),
                        "after" to (it["after"]?.toString() ?: ""),
                    )
                }
                current.copy(clozeItems = current.clozeItems + items)
            }
            "practice" -> {
                val items = event.items.mapNotNull {
                    it as? Map<*, *>
                }.map { item ->
                    item.entries.associate { e -> e.key.toString() to (e.value ?: "") }
                }
                current.copy(practiceQuestions = current.practiceQuestions + items)
            }
            "summary" -> {
                val items = event.items.mapNotNull {
                    it as? Map<*, *>
                }.map { item ->
                    item.entries.associate { e -> e.key.toString() to (e.value ?: "") }
                }
                current.copy(summarySections = current.summarySections + items)
            }
            else -> current
        }
    }
}
