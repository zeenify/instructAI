package com.instructai.cognify.ui.reviews

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.entity.CourseEntity
import com.instructai.cognify.data.local.entity.LessonEntity
import com.instructai.cognify.data.local.entity.ModuleEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.LmsRepository
import com.instructai.cognify.data.repository.ReviewRepository
import com.instructai.cognify.data.repository.MAX_CONTENT_CHARS
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

enum class SourceTab { MODULES, SOURCE }

data class ReviewerTypeConfig(
    val enabled: Boolean = true,
    val count: Int = 10,
)

data class CourseTreeNode(
    val course: CourseEntity,
    val modules: List<TreeNodeModule>,
)

data class TreeNodeModule(
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

data class FileItem(
    val uri: Uri,
    val fileName: String,
    val extractedText: String = "",
    val isExtracting: Boolean = false,
    val error: String? = null,
    val hasBeenExtracted: Boolean = false,
)

data class ReviewCreationState(
    val sourceTab: SourceTab = SourceTab.MODULES,
    val courseTrees: List<CourseTreeNode> = emptyList(),
    val moduleLoading: Boolean = false,
    val files: List<FileItem> = emptyList(),
    val previewFileIndex: Int? = null,
    val pastedText: String = "",
    val photos: List<PhotoItem> = emptyList(),
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
    val errorLog: List<String> = emptyList(),
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
    private val logger: AppLogger,
) : ViewModel() {

    private val _state = MutableStateFlow(ReviewCreationState())
    val state: StateFlow<ReviewCreationState> = _state.asStateFlow()

    init {
        loadModules()
    }

    private fun loadModules() {
        viewModelScope.launch {
            _state.update { it.copy(moduleLoading = true, error = null) }
            buildModuleTrees()
            _state.update { it.copy(moduleLoading = false) }
        }
    }

    fun refreshModules() {
        viewModelScope.launch {
            _state.update { it.copy(moduleLoading = true, error = null) }
            try { lmsRepository.syncAll() } catch (_: Exception) { }
            try {
                val classes = lmsRepository.getCachedClasses().first()
                for (cls in classes) {
                    val courses = lmsRepository.getCachedCourses(cls.id).first()
                    for (course in courses) {
                        try { lmsRepository.syncCourseDetail(course.id) } catch (_: Exception) { }
                    }
                }
            } catch (_: Exception) { }
            buildModuleTrees()
            _state.update { it.copy(moduleLoading = false) }
        }
    }

    private suspend fun buildModuleTrees() {
        val courses = mutableMapOf<Long, CourseEntity>()
        val courseModules = mutableMapOf<Long, MutableList<TreeNodeModule>>()

        val classes = lmsRepository.getCachedClasses().first()
        for (cls in classes) {
            val classCourses = lmsRepository.getCachedCourses(cls.id).first()
            for (course in classCourses) {
                courses[course.id] = course
                val modules = lmsRepository.getCachedModules(course.id).first()
                val treeModules = modules.map { module ->
                    val lessons = lmsRepository.getCachedLessons(module.id).first()
                    TreeNodeModule(module = module, lessons = lessons)
                }
                courseModules[course.id] = treeModules.toMutableList()
            }
        }

        val trees = courses.entries
            .sortedBy { it.value.orderIndex }
            .map { (courseId, course) ->
                CourseTreeNode(
                    course = course,
                    modules = courseModules[courseId]?.sortedBy { it.module.orderIndex } ?: emptyList(),
                )
            }

        _state.update { it.copy(courseTrees = trees) }
    }

    fun setSourceTab(tab: SourceTab) {
        _state.update { it.copy(sourceTab = tab) }
    }

    fun toggleLesson(courseIndex: Int, moduleIndex: Int, lessonId: Long) {
        _state.update { state ->
            val courses = state.courseTrees.toMutableList()
            if (courseIndex !in courses.indices) return@update state
            val modules = courses[courseIndex].modules.toMutableList()
            if (moduleIndex !in modules.indices) return@update state
            val tree = modules[moduleIndex]
            val selected = tree.selectedLessonIds.toMutableSet()
            if (selected.contains(lessonId)) selected.remove(lessonId) else selected.add(lessonId)
            modules[moduleIndex] = tree.copy(selectedLessonIds = selected)
            courses[courseIndex] = courses[courseIndex].copy(modules = modules)
            state.copy(courseTrees = courses)
        }
    }

    fun selectAllInCourseModule(courseIndex: Int, moduleIndex: Int) {
        _state.update { state ->
            val courses = state.courseTrees.toMutableList()
            if (courseIndex !in courses.indices) return@update state
            val modules = courses[courseIndex].modules.toMutableList()
            if (moduleIndex !in modules.indices) return@update state
            val tree = modules[moduleIndex]
            val allIds = tree.lessons.map { it.id }.toSet()
            val selected = if (tree.selectedLessonIds.containsAll(allIds)) emptySet() else allIds
            modules[moduleIndex] = tree.copy(selectedLessonIds = selected)
            courses[courseIndex] = courses[courseIndex].copy(modules = modules)
            state.copy(courseTrees = courses)
        }
    }

    fun addFiles(uris: List<Uri>, names: List<String>) {
        val existingUris = _state.value.files.map { it.uri }.toSet()
        val newFiles = uris.zip(names).map { (uri, name) ->
            FileItem(uri = uri, fileName = name)
        }.filter { it.uri !in existingUris }
        if (newFiles.isNotEmpty()) {
            _state.update { it.copy(files = it.files + newFiles) }
        }
    }

    fun removeFile(index: Int) {
        _state.update { s ->
            val updated = s.files.toMutableList()
            if (index in updated.indices) updated.removeAt(index)
            s.copy(files = updated, previewFileIndex = null)
        }
    }

    fun clearAllFiles() {
        _state.update { it.copy(files = emptyList(), previewFileIndex = null) }
    }

    fun extractAllFiles() {
        val pending = _state.value.files.indices.filter { i ->
            val f = _state.value.files[i]
            f.extractedText.isBlank() && !f.isExtracting && f.error == null
        }
        if (pending.isEmpty()) return

        _state.update { s ->
            val updated = s.files.toMutableList()
            for (i in pending) {
                updated[i] = updated[i].copy(isExtracting = true, error = null)
            }
            s.copy(files = updated)
        }

        for (index in pending) {
            viewModelScope.launch {
                val uri = _state.value.files[index].uri
                try {
                    val text = reviewerRepository.extractText(uri)
                    _state.update { s ->
                        val updated = s.files.toMutableList()
                        if (index in updated.indices) {
                            updated[index] = updated[index].copy(extractedText = text, isExtracting = false, hasBeenExtracted = true)
                        }
                        s.copy(files = updated)
                    }
                } catch (e: Exception) {
                    logger.log("CreateReviewViewModel", "extractAllFiles failed for index=$index", e)
                    _state.update { s ->
                        val updated = s.files.toMutableList()
                        if (index in updated.indices) {
                            updated[index] = updated[index].copy(isExtracting = false, error = e.message, hasBeenExtracted = true)
                        }
                        s.copy(files = updated)
                    }
                }
            }
        }
    }

    fun showFilePreview(index: Int) {
        _state.update { it.copy(previewFileIndex = index) }
    }

    fun dismissFilePreview() {
        _state.update { it.copy(previewFileIndex = null) }
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
                logger.log("CreateReviewViewModel", "addPhoto OCR failed for $uri", e)
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

    fun generate() {
        val s = _state.value
        val content = resolveContent(s) ?: return
        val title = resolveTitle(s)
        val types = buildReviewerTypes(s)
        val counts = buildCounts(s)

        viewModelScope.launch {
            _state.update { it.copy(isGenerating = true, generationProgress = emptyList(), generationResult = null, error = null, errorLog = emptyList()) }

            val progressItems = mutableListOf<GenProgressItem>()
            var result = ReviewerResultState()
            val errors = mutableListOf<String>()

            try {
                reviewerRepository.generateReviewer(content, title, types, counts, s.difficulty)
                    .collect { event ->
                        when (event) {
                            is ReviewerEvent.Progress -> {
                                val existing = progressItems.indexOfFirst { it.type == event.type }
                                if (existing >= 0) {
                                    progressItems[existing] = progressItems[existing].copy(status = event.status)
                                } else {
                                    progressItems.add(GenProgressItem(event.type, event.status))
                                }
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
                                val msg = "[${event.type}] ${event.message}"
                                errors.add(msg)
                                val existing = progressItems.indexOfFirst { it.type == event.type }
                                if (existing >= 0) {
                                    progressItems[existing] = progressItems[existing].copy(status = "error")
                                } else {
                                    progressItems.add(GenProgressItem(event.type, "error"))
                                }
                                _state.update { it.copy(
                                    generationProgress = progressItems.toList(),
                                    error = msg,
                                    errorLog = errors.toList(),
                                )}
                            }
                            is ReviewerEvent.Complete -> {
                                _state.update { it.copy(isGenerating = false, errorLog = errors.toList()) }
                            }
                        }
                    }
            } catch (e: Exception) {
                val msg = "Fatal error: ${e.message ?: "Unknown"}"
                logger.log("CreateReviewViewModel", "generate() caught fatal", e)
                errors.add(msg)
                _state.update { it.copy(
                    isGenerating = false,
                    error = msg,
                    errorLog = errors.toList(),
                )}
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
        val summaryJson = if (result.summarySections.isNotEmpty()) {
            try {
                val arr = org.json.JSONArray()
                result.summarySections.forEach { section ->
                    val obj = org.json.JSONObject()
                    obj.put("title", section["title"]?.toString() ?: "")
                    val pts = org.json.JSONArray()
                    (section["points"] as? List<*>)?.forEach { pts.put(it?.toString() ?: "") }
                    obj.put("points", pts)
                    arr.put(obj)
                }
                arr.toString(2)
            } catch (_: Exception) { "" }
        } else ""
        val reviewId = reviewRepository.createReview(
            title = title,
            sourceType = "ai_generated",
            contentText = content.take(500),
            difficulty = s.difficulty,
        )
        if (reviewId <= 0) return -1
        reviewRepository.setPendingHighlight(reviewId)

        if (summaryJson.isNotBlank()) {
            val review = reviewRepository.getReviewById(reviewId)
            if (review != null) {
                reviewRepository.updateReview(review.copy(studyGuide = summaryJson))
            }
        }

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
                    val questionType = q["type"]?.toString() ?: "multiple_choice"
                    val rawOptions = q["options"]
                    val optionsJson = when {
                        rawOptions is List<*> && rawOptions.isNotEmpty() -> {
                            try { org.json.JSONArray(rawOptions).toString() } catch (_: Exception) { rawOptions.joinToString("|") }
                        }
                        questionType == "true_false" -> """["True", "False"]"""
                        else -> ""
                    }
                    com.instructai.cognify.data.local.entity.PracticeQuestionEntity(
                        reviewId = reviewId,
                        questionType = questionType,
                        questionText = q["question"]?.toString() ?: "",
                        options = optionsJson,
                        correctAnswer = q["correct_answer"]?.toString() ?: "",
                        explanation = q["explanation"]?.toString() ?: "",
                    )
                },
            )
        }
        return reviewId
    }

    private fun resolveContent(state: ReviewCreationState): String? {
        return when (state.sourceTab) {
            SourceTab.MODULES -> {
                val lessonIds = state.courseTrees.flatMap { course ->
                    course.modules.flatMap { it.selectedLessonIds.toList() }
                }
                if (lessonIds.isEmpty()) {
                    _state.update { it.copy(error = "Select at least one lesson") }
                    return null
                }
                val allLessons = state.courseTrees.flatMap { course ->
                    course.modules.flatMap { m -> m.lessons.map { l -> l } }
                }
                val content = lessonIds.mapNotNull { id ->
                    allLessons.find { it.id == id }?.let { "${it.title}\n${it.content}" }
                }.joinToString("\n\n---\n\n")
                if (content.isBlank()) {
                    _state.update { it.copy(error = "Selected lessons have no content") }
                    return null
                }
                content
            }
            SourceTab.SOURCE -> {
                val parts = mutableListOf<String>()
                if (state.pastedText.isNotBlank()) parts.add(state.pastedText)
                val photoTexts = state.photos
                    .map { it.ocrText }
                    .filter { it.isNotBlank() }
                parts.addAll(photoTexts)
                val fileTexts = state.files
                    .map { it.extractedText }
                    .filter { it.isNotBlank() }
                parts.addAll(fileTexts)
                if (parts.isEmpty()) {
                    _state.update { it.copy(error = "Add some text, photos, or files first") }
                    return null
                }
                val joined = parts.joinToString("\n\n---\n\n")
                if (joined.length > MAX_CONTENT_CHARS) joined.take(MAX_CONTENT_CHARS) else joined
            }
        }
    }

    private fun resolveTitle(state: ReviewCreationState): String {
        return when (state.sourceTab) {
            SourceTab.MODULES -> {
                val allLessons = state.courseTrees.flatMap { course ->
                    course.modules.flatMap { m -> m.lessons.map { l -> l } }
                }
                val lessonIds = state.courseTrees.flatMap { course ->
                    course.modules.flatMap { it.selectedLessonIds.toList() }
                }
                allLessons.find { it.id == lessonIds.firstOrNull() }?.title ?: "Selected Lessons"
            }
            SourceTab.SOURCE -> {
                val firstLine = state.pastedText.lineSequence().firstOrNull { it.isNotBlank() }
                firstLine ?: state.files.firstOrNull()?.fileName ?: "Study Material"
            }
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
