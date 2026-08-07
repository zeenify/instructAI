package com.instructai.cognify.ui.reviews

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image as FoundationImage
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Style
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.TabRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.ui.theme.CognifyColors
import kotlinx.coroutines.launch

private enum class ScreenMode { FORM, PROGRESS, PREVIEW }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateReviewScreen(
    onBack: () -> Unit,
    onCreated: (reviewId: Long) -> Unit,
    viewModel: CreateReviewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showSaveDialog by remember { mutableStateOf(false) }
    var reviewTitle by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    val screenMode = when {
        state.isGenerating -> ScreenMode.PROGRESS
        state.generationResult != null -> ScreenMode.PREVIEW
        else -> ScreenMode.FORM
    }

    LaunchedEffect(state.error) {
        state.error?.let { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (screenMode) {
                            ScreenMode.FORM -> "Create Reviewer"
                            ScreenMode.PROGRESS -> "Generating..."
                            ScreenMode.PREVIEW -> "Reviewer Preview"
                        },
                        fontWeight = FontWeight.Bold,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { onBack() }) {
                        Icon(Icons.Filled.Close, "Close")
                    }
                },
                actions = {
                    if (screenMode == ScreenMode.PREVIEW) {
                        OutlinedButton(
                            onClick = { viewModel.regenerate() },
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Icon(Icons.Filled.Refresh, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Redo")
                        }
                        Spacer(Modifier.width(4.dp))
                        Button(
                            onClick = { showSaveDialog = true },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                        ) {
                            Icon(Icons.Filled.Save, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Save")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        AnimatedContent(
            targetState = screenMode,
            modifier = Modifier.padding(padding),
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "screen",
        ) { mode ->
            when (mode) {
                ScreenMode.FORM -> CreationForm(state, viewModel)
                ScreenMode.PROGRESS -> GenerationProgressScreen(
                    progressItems = state.generationProgress,
                    errorLog = state.errorLog,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                ScreenMode.PREVIEW -> ReviewerPreviewContent(
                    result = state.generationResult ?: ReviewerResultState(),
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }

    if (showSaveDialog && state.generationResult != null) {
        Dialog(
            onDismissRequest = { showSaveDialog = false },
            properties = DialogProperties(usePlatformDefaultWidth = false),
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Save Reviewer", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall, color = CognifyColors.ElectricViolet)
                    Text("Name your reviewer:", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(
                        value = reviewTitle,
                        onValueChange = { reviewTitle = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { showSaveDialog = false }) { Text("Cancel") }
                        Spacer(Modifier.width(8.dp))
                        Button(
                            onClick = {
                                val trimmed = reviewTitle.trim()
                                if (trimmed.isNotBlank()) {
                                    scope.launch {
                                        val id = viewModel.saveReview(trimmed)
                                        if (id > 0) onCreated(id)
                                    }
                                    showSaveDialog = false
                                }
                            },
                            enabled = reviewTitle.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                            shape = RoundedCornerShape(12.dp),
                        ) { Text("Save") }
                    }
                }
            }
        }
    }
}

@Composable
private fun CreationForm(state: ReviewCreationState, viewModel: CreateReviewViewModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        SourceTabRow(
            selectedTab = state.sourceTab,
            onTabSelected = { viewModel.setSourceTab(it) },
        )

        Spacer(Modifier.height(12.dp))

        when (state.sourceTab) {
            SourceTab.MODULES -> ModulesSource(state, viewModel)
            SourceTab.SOURCE -> SourceContent(state, viewModel)
        }

        Spacer(Modifier.height(20.dp))
        Text("Reviewer Types", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))

        ReviewTypeToggle(
            icon = Icons.Filled.Style, label = "Flashcards", desc = "Q&A pairs with spaced repetition",
            color = CognifyColors.ElectricViolet, enabled = state.flashcardEnabled, count = state.flashcardCount,
            onToggle = { viewModel.toggleFlashcard() },
            onCountChange = { viewModel.setFlashcardCount(it) },
        )
        Spacer(Modifier.height(6.dp))
        ReviewTypeToggle(
            icon = Icons.Filled.Edit, label = "Cloze Test", desc = "Fill-in-the-blank exercises",
            color = Color(0xFF00BCD4), enabled = state.clozeEnabled, count = state.clozeCount,
            onToggle = { viewModel.toggleCloze() },
            onCountChange = { viewModel.setClozeCount(it) },
        )
        Spacer(Modifier.height(6.dp))
        ReviewTypeToggle(
            icon = Icons.Filled.CheckCircle, label = "Practice Questions", desc = "MCQs, true/false, short answer",
            color = Color(0xFFFF9800), enabled = state.practiceEnabled, count = state.practiceCount,
            onToggle = { viewModel.togglePractice() },
            onCountChange = { viewModel.setPracticeCount(it) },
        )
        Spacer(Modifier.height(6.dp))
        ReviewTypeToggle(
            icon = Icons.Filled.Description, label = "Summary Notes", desc = "Condensed key points",
            color = Color(0xFF4CAF50), enabled = state.summaryEnabled, count = 1,
            onToggle = { viewModel.toggleSummary() },
            onCountChange = {}, hideCount = true,
        )

        Spacer(Modifier.height(20.dp))
        Text("Difficulty", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("easy", "medium", "hard").forEach { d ->
                val sel = state.difficulty == d
                OutlinedButton(
                    onClick = { viewModel.setDifficulty(d) },
                    colors = if (sel) ButtonDefaults.outlinedButtonColors(
                        containerColor = CognifyColors.ElectricViolet.copy(alpha = 0.15f),
                    ) else ButtonDefaults.outlinedButtonColors(),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(d.replaceFirstChar { it.uppercase() },
                        color = if (sel) CognifyColors.ElectricViolet else MaterialTheme.colorScheme.onSurface,
                        fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
        }

        Spacer(Modifier.height(24.dp))
        Button(
            onClick = { viewModel.generate() },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = !state.isGenerating,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
        ) {
            Icon(Icons.Filled.RocketLaunch, null)
            Spacer(Modifier.width(8.dp))
            Text("Generate Reviewer", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun SourceTabRow(selectedTab: SourceTab, onTabSelected: (SourceTab) -> Unit) {
    TabRow(
        selectedTabIndex = selectedTab.ordinal,
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = CognifyColors.ElectricViolet,
    ) {
        listOf(
            SourceTab.MODULES to (Icons.Filled.LibraryBooks to "Classes"),
            SourceTab.SOURCE to (Icons.Filled.FileUpload to "Upload"),
        ).forEach { (tab, pair) ->
            Tab(
                selected = selectedTab == tab,
                onClick = { onTabSelected(tab) },
                icon = { Icon(pair.first, null, modifier = Modifier.size(18.dp)) },
                text = { Text(pair.second, style = MaterialTheme.typography.labelLarge) },
            )
        }
    }
}

@Composable
private fun ModulesSource(state: ReviewCreationState, viewModel: CreateReviewViewModel) {
    Card(Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Your Courses", style = MaterialTheme.typography.labelMedium)
                TextButton(onClick = { viewModel.refreshModules() }, enabled = !state.moduleLoading) {
                    if (state.moduleLoading) {
                        CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(4.dp))
                    }
                    Icon(Icons.Filled.Refresh, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(2.dp))
                    Text(if (state.moduleLoading) "Syncing..." else "Sync", style = MaterialTheme.typography.labelSmall)
                }
            }
            if (state.courseTrees.isEmpty()) {
                Text(if (state.moduleLoading) "Loading..." else "No courses loaded. Tap Sync to fetch your data.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            } else {
                state.courseTrees.forEachIndexed { ci, courseTree ->
                    var courseExpanded by remember { mutableStateOf(false) }
                    val totalLessons = courseTree.modules.sumOf { it.lessons.size }
                    val totalSelected = courseTree.modules.sumOf { it.selectedLessonIds.size }

                    Column(Modifier.padding(vertical = 4.dp)) {
                        Row(
                            Modifier.fillMaxWidth().clickable { courseExpanded = !courseExpanded }.padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier.size(8.dp).clip(CircleShape)
                                    .background(if (courseTree.course.isCoding) Color(0xFF00BCD4) else CognifyColors.ElectricViolet)
                            )
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(courseTree.course.title, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyLarge)
                                Text("${courseTree.modules.size} modules • $totalLessons lessons • $totalSelected selected",
                                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Icon(if (courseExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, null, modifier = Modifier.size(20.dp))
                        }

                        AnimatedVisibility(courseExpanded) {
                            Column(Modifier.padding(start = 16.dp)) {
                                courseTree.modules.forEachIndexed { mi, mod ->
                                    var moduleExpanded by remember { mutableStateOf(false) }
                                    val sel = mod.selectedLessonIds.size

                                    Column(Modifier.padding(vertical = 2.dp)) {
                                        Row(
                                            Modifier.fillMaxWidth().clickable { moduleExpanded = !moduleExpanded }.padding(vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Icon(Icons.Filled.LibraryBooks, null, tint = CognifyColors.ElectricViolet, modifier = Modifier.size(18.dp))
                                            Spacer(Modifier.width(6.dp))
                                            Column(Modifier.weight(1f)) {
                                                Text(mod.module.title, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
                                                Text("${mod.lessons.size} lessons • $sel selected",
                                                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            }
                                            IconButton(onClick = { viewModel.selectAllInCourseModule(ci, mi) }, modifier = Modifier.size(28.dp)) {
                                                Icon(if (sel == mod.lessons.size && mod.lessons.isNotEmpty())
                                                    Icons.Filled.RadioButtonChecked else Icons.Filled.RadioButtonUnchecked,
                                                    "Select all", tint = CognifyColors.ElectricViolet, modifier = Modifier.size(18.dp))
                                            }
                                            Icon(if (moduleExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, null, modifier = Modifier.size(18.dp))
                                        }

                                        AnimatedVisibility(moduleExpanded) {
                                            Column(Modifier.padding(start = 24.dp)) {
                                                mod.lessons.forEach { lesson ->
                                                    Row(
                                                        Modifier.fillMaxWidth().clickable { viewModel.toggleLesson(ci, mi, lesson.id) }.padding(vertical = 5.dp),
                                                        verticalAlignment = Alignment.CenterVertically,
                                                    ) {
                                                        Icon(if (mod.selectedLessonIds.contains(lesson.id))
                                                            Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, null,
                                                            tint = if (mod.selectedLessonIds.contains(lesson.id)) CognifyColors.ElectricViolet
                                                            else MaterialTheme.colorScheme.onSurfaceVariant,
                                                            modifier = Modifier.size(16.dp))
                                                        Spacer(Modifier.width(6.dp))
                                                        Text(lesson.title, style = MaterialTheme.typography.bodySmall,
                                                            color = if (mod.selectedLessonIds.contains(lesson.id)) MaterialTheme.colorScheme.onSurface
                                                            else MaterialTheme.colorScheme.onSurfaceVariant)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceContent(state: ReviewCreationState, viewModel: CreateReviewViewModel) {
    val context = LocalContext.current
    val fileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            val names = uris.map { uri ->
                var name = "Unknown"
                context.contentResolver.query(uri, null, null, null, null)?.use { c ->
                    if (c.moveToFirst()) {
                        val idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                        if (idx >= 0) name = c.getString(idx)
                    }
                }
                name
            }
            viewModel.addFiles(uris, names)
        }
    }
    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { viewModel.addPhoto(it, "Photo ${state.photos.size + 1}") }
    }

    Card(Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            OutlinedTextField(
                value = state.pastedText,
                onValueChange = { viewModel.setPastedText(it) },
                modifier = Modifier.fillMaxWidth().height(120.dp),
                placeholder = { Text("Paste your study material here...") },
                shape = RoundedCornerShape(12.dp),
            )
            Text("${state.pastedText.length} chars", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))

            if (state.photos.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text("Photos", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    state.photos.forEachIndexed { index, photo ->
                        Box(modifier = Modifier.size(56.dp)) {
                            if (photo.isProcessing) {
                                Box(Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
                                    contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                                }
                            } else {
                                val bitmap = remember(photo.uri) {
                                    try {
                                        context.contentResolver.openInputStream(photo.uri)?.use {
                                            BitmapFactory.decodeStream(it)
                                        }
                                    } catch (e: Exception) { null }
                                }
                                if (bitmap != null) {
                                    FoundationImage(
                                        bitmap = bitmap.asImageBitmap(),
                                        contentDescription = "Photo ${index + 1}",
                                        modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop,
                                    )
                                } else {
                                    Box(Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
                                        contentAlignment = Alignment.Center) {
                                        Icon(Icons.Filled.Image, null, Modifier.size(20.dp),
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                            IconButton(onClick = { viewModel.removePhoto(index) },
                                modifier = Modifier.align(Alignment.TopEnd).size(16.dp)) {
                                Icon(Icons.Filled.Close, "Remove", Modifier.size(12.dp),
                                    tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { photoPicker.launch("image/*") },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = CognifyColors.ElectricViolet),
                ) {
                    Icon(Icons.Filled.Image, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add Photo", style = MaterialTheme.typography.labelMedium)
                }
            }

            Spacer(Modifier.height(12.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)))
            Spacer(Modifier.height(12.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Source Files", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                TextButton(onClick = {
                    fileLauncher.launch(arrayOf(
                        "application/pdf",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        "text/plain",
                    ))
                }) {
                    Icon(Icons.Filled.FileUpload, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add Files")
                }
            }

            if (state.files.isEmpty()) {
                Spacer(Modifier.height(12.dp))
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text("No files selected", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(4.dp))
            } else {
                Spacer(Modifier.height(8.dp))
                state.files.forEachIndexed { index, file ->
                    FileCard(
                        file = file,
                        onPreview = { viewModel.showFilePreview(index) },
                        onRemove = { viewModel.removeFile(index) },
                    )
                    if (index < state.files.lastIndex) Spacer(Modifier.height(6.dp))
                }

                Spacer(Modifier.height(12.dp))
                val totalChars = state.files.sumOf { it.extractedText.length }
                val pendingCount = state.files.count { !it.hasBeenExtracted && !it.isExtracting && it.error == null }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("${state.files.size} file(s)  •  $totalChars chars", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (state.files.any { it.extractedText.isNotBlank() }) {
                        TextButton(onClick = { viewModel.clearAllFiles() }) {
                            Icon(Icons.Filled.DeleteSweep, null, Modifier.size(16.dp))
                            Spacer(Modifier.width(2.dp))
                            Text("Clear All", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                if (pendingCount > 0) {
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { viewModel.extractAllFiles() },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                    ) {
                        if (state.files.any { it.isExtracting }) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                            Spacer(Modifier.width(8.dp))
                        }
                        Icon(Icons.Filled.Description, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(if (state.files.any { it.isExtracting }) "Extracting..." else "Extract All ($pendingCount)")
                    }
                }
            }
        }
    }

    state.previewFileIndex?.let { index ->
        val file = state.files.getOrNull(index)
        if (file != null) {
            FilePreviewDialog(
                fileName = file.fileName,
                text = file.extractedText,
                hasBeenExtracted = file.hasBeenExtracted,
                onDismiss = { viewModel.dismissFilePreview() },
            )
        }
    }
}

@Composable
private fun FileCard(
    file: FileItem,
    onPreview: () -> Unit,
    onRemove: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when {
                file.error != null -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
                file.extractedText.isNotBlank() -> CognifyColors.ElectricViolet.copy(alpha = 0.06f)
                else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
            }
        ),
        shape = RoundedCornerShape(10.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            val mimeIcon = when {
                file.fileName.endsWith(".pdf", ignoreCase = true) -> Icons.Filled.Description
                file.fileName.endsWith(".docx", ignoreCase = true) -> Icons.Filled.Edit
                file.fileName.endsWith(".pptx", ignoreCase = true) -> Icons.Filled.Edit
                else -> Icons.Filled.FileUpload
            }
            Icon(mimeIcon, null, tint = CognifyColors.ElectricViolet, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))

            Column(Modifier.weight(1f)) {
                Text(file.fileName, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                when {
                    file.isExtracting -> Text("Extracting...", style = MaterialTheme.typography.labelSmall, color = CognifyColors.ElectricViolet)
                    file.error != null -> Text("Error: ${file.error}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                    file.extractedText.isNotBlank() -> Text("${file.extractedText.length} chars extracted", style = MaterialTheme.typography.labelSmall, color = Color(0xFF4CAF50))
                    file.hasBeenExtracted -> Text("No text found (image-based file?)", style = MaterialTheme.typography.labelSmall, color = Color(0xFFFFA726))
                    else -> Text("Not extracted", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (file.isExtracting) {
                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            } else {
                IconButton(onClick = onPreview, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Filled.Visibility, "Preview", Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = onRemove, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Filled.Close, "Remove", Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun FilePreviewDialog(
    fileName: String,
    text: String,
    hasBeenExtracted: Boolean,
    onDismiss: () -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnClickOutside = true),
    ) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(20.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(fileName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${text.length} chars", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, "Close")
                    }
                }
                Spacer(Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(Modifier.height(12.dp))

                val displayText = when {
                    text.isNotBlank() -> text
                    hasBeenExtracted -> "No text could be extracted from this file. It may contain only images/scanned content."
                    else -> "No text extracted yet."
                }
                Box(
                    modifier = Modifier.fillMaxWidth().height(400.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp),
                ) {
                    Text(
                        text = displayText,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (text.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

@Composable
private fun ReviewTypeToggle(
    icon: ImageVector, label: String, desc: String, color: Color,
    enabled: Boolean, count: Int, onToggle: () -> Unit, onCountChange: (Int) -> Unit, hideCount: Boolean = false,
) {
    Card(Modifier.fillMaxWidth().clickable { onToggle() },
        colors = CardDefaults.cardColors(containerColor = if (enabled) color.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(if (enabled) color.copy(alpha = 0.2f) else Color.Gray.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = if (enabled) color else Color.Gray, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(label, fontWeight = FontWeight.Medium, color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
                Text(desc, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (!hideCount && enabled) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(
                        onClick = { if (count > 3) onCountChange(count - 1) },
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier.size(32.dp),
                    ) { Text("-", fontWeight = FontWeight.Bold) }
                    Text("$count", fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp))
                    TextButton(
                        onClick = { if (count < 30) onCountChange(count + 1) },
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier.size(32.dp),
                    ) { Text("+", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
fun ReviewerPreviewContent(result: ReviewerResultState, modifier: Modifier = Modifier) {
    val tabs = listOfNotNull(
        PreviewTab("flashcards", "Flashcards", result.flashcards.size).takeIf { result.flashcards.isNotEmpty() },
        PreviewTab("cloze", "Cloze", result.clozeItems.size).takeIf { result.clozeItems.isNotEmpty() },
        PreviewTab("practice", "Practice", result.practiceQuestions.size).takeIf { result.practiceQuestions.isNotEmpty() },
        PreviewTab("summary", "Summary", result.summarySections.size).takeIf { result.summarySections.isNotEmpty() },
    )
    var selectedTab by remember { mutableIntStateOf(0) }

    Column(modifier.fillMaxSize()) {
        val safeIndex = selectedTab.coerceIn(0, tabs.lastIndex.coerceAtLeast(0))
        if (tabs.isNotEmpty()) {
            ScrollableTabRow(
                selectedTabIndex = safeIndex,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = CognifyColors.ElectricViolet,
                edgePadding = 0.dp,
            ) {
                tabs.forEachIndexed { i, tab ->
                    Tab(selected = safeIndex == i, onClick = { selectedTab = i },
                        text = { Text("${tab.label} (${tab.count})", maxLines = 1, style = MaterialTheme.typography.labelLarge) })
                }
            }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                when (tabs.getOrNull(safeIndex)?.id) {
                    "flashcards" -> FlashcardList(result.flashcards)
                    "cloze" -> ClozeList(result.clozeItems)
                    "practice" -> PracticeList(result.practiceQuestions)
                    "summary" -> SummaryList(result.summarySections)
                }
            }
        } else {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No content generated", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun FlashcardList(flashcards: List<Map<String, String>>) {
    var expanded by remember { mutableIntStateOf(-1) }
    Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        flashcards.forEachIndexed { i, fc ->
            val front = fc["front"] ?: ""
            val back = fc["back"] ?: ""
            val open = expanded == i
            Card(Modifier.fillMaxWidth().clickable { expanded = if (open) -1 else i },
                colors = CardDefaults.cardColors(containerColor = if (open) CognifyColors.ElectricViolet.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                shape = RoundedCornerShape(10.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(26.dp).clip(RoundedCornerShape(6.dp)).background(CognifyColors.ElectricViolet.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center) {
                            Text("${i + 1}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall, color = CognifyColors.ElectricViolet)
                        }
                        Spacer(Modifier.width(10.dp))
                        Text(front, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, maxLines = if (open) Int.MAX_VALUE else 2, overflow = TextOverflow.Ellipsis)
                    }
                    if (open) {
                        Spacer(Modifier.height(8.dp))
                        Box(Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)))
                        Spacer(Modifier.height(8.dp))
                        Text(back, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun ClozeList(items: List<Map<String, String>>) {
    Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEachIndexed { i, it ->
            val before = it["before"] ?: ""
            val blank = it["blank"] ?: ""
            val after = it["after"] ?: ""
            var show by remember { mutableStateOf(false) }
            Card(Modifier.fillMaxWidth().clickable { show = !show },
                colors = CardDefaults.cardColors(containerColor = if (show) Color(0xFF00BCD4).copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                shape = RoundedCornerShape(10.dp)) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(26.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFF00BCD4).copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center) {
                        Text("${i + 1}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall, color = Color(0xFF00BCD4))
                    }
                    Spacer(Modifier.width(10.dp))
                    val blankDisplay = if (show) "[$blank]" else "[...]"
                    Text("$before $blankDisplay $after", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun PracticeList(questions: List<Map<String, Any>>) {
    var revealed by remember { mutableIntStateOf(-1) }
    Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        questions.forEachIndexed { i, q ->
            val qt = q["question"]?.toString() ?: ""
            val type = q["type"]?.toString() ?: "multiple_choice"
            val opts = (q["options"] as? List<*>)?.map { it.toString() } ?: emptyList()
            val correct = q["correct_answer"]?.toString() ?: ""
            val expl = q["explanation"]?.toString() ?: ""
            val open = revealed == i
            Card(Modifier.fillMaxWidth().clickable { revealed = if (open) -1 else i },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                shape = RoundedCornerShape(10.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(26.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFFFF9800).copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center) {
                            Text("${i + 1}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall, color = Color(0xFFFF9800))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(qt, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("[$type]", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if (open) {
                        Spacer(Modifier.height(6.dp))
                        Box(Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)))
                        Spacer(Modifier.height(6.dp))
                        if (opts.isNotEmpty()) {
                            opts.forEach { Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 1.dp)) }
                        }
                        Text("✔ $correct", fontWeight = FontWeight.Bold, color = Color(0xFF4CAF50), style = MaterialTheme.typography.bodySmall)
                        if (expl.isNotBlank()) Text(expl, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryList(sections: List<Map<String, Any>>) {
    Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        sections.forEach { section ->
            val title = section["title"]?.toString() ?: ""
            val points = (section["points"] as? List<*>)?.map { it.toString() } ?: emptyList()
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFF4CAF50).copy(alpha = 0.06f)), shape = RoundedCornerShape(10.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(6.dp))
                    points.forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 1.dp)) }
                }
            }
        }
    }
}

private data class PreviewTab(val id: String, val label: String, val count: Int)
