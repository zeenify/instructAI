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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
        AlertDialog(
            onDismissRequest = { showSaveDialog = false },
            title = { Text("Save Reviewer", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Name your reviewer:", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = reviewTitle,
                        onValueChange = { reviewTitle = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            val id = viewModel.saveReview(reviewTitle)
                            if (id > 0) onCreated(id)
                        }
                        showSaveDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                ) { Text("Save & Study") }
            },
            dismissButton = {
                TextButton(onClick = { showSaveDialog = false }) { Text("Cancel") }
            },
        )
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
            SourceTab.FILE -> FileSource(state, viewModel)
            SourceTab.TEXT -> TextSource(state, viewModel)
        }

        Spacer(Modifier.height(20.dp))
        Text("Reviewer Types", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))

        ReviewTypeToggle(
            icon = Icons.Filled.AutoAwesome, label = "Flashcards", desc = "Q&A pairs with spaced repetition",
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
            enabled = state.isExtracting,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
        ) {
            Icon(Icons.Filled.AutoAwesome, null)
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
            SourceTab.FILE to (Icons.Filled.FileUpload to "Upload"),
            SourceTab.TEXT to (Icons.Filled.Edit to "Paste"),
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
            if (state.moduleTrees.isEmpty()) {
                Text("No modules available. Sync your classes first.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                state.moduleTrees.forEachIndexed { i, tree ->
                    var expanded by remember { mutableStateOf(false) }
                    val selCount = tree.selectedLessonIds.size
                    Column(Modifier.padding(vertical = 4.dp)) {
                        Row(
                            Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Filled.LibraryBooks, null, tint = CognifyColors.ElectricViolet, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(tree.module.title, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyLarge)
                                Text("${tree.lessons.size} lessons • $selCount selected",
                                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            IconButton(onClick = { viewModel.selectAllInModule(i) }) {
                                Icon(if (selCount == tree.lessons.size && tree.lessons.isNotEmpty())
                                    Icons.Filled.RadioButtonChecked else Icons.Filled.RadioButtonUnchecked,
                                    "All", tint = CognifyColors.ElectricViolet)
                            }
                            Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, null, modifier = Modifier.size(20.dp))
                        }
                        AnimatedVisibility(expanded) {
                            Column(Modifier.padding(start = 28.dp)) {
                                tree.lessons.forEach { lesson ->
                                    Row(
                                        Modifier.fillMaxWidth().clickable { viewModel.toggleLesson(i, lesson.id) }.padding(vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(if (tree.selectedLessonIds.contains(lesson.id))
                                            Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, null,
                                            tint = if (tree.selectedLessonIds.contains(lesson.id)) CognifyColors.ElectricViolet
                                            else MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(lesson.title, style = MaterialTheme.typography.bodyMedium,
                                            color = if (tree.selectedLessonIds.contains(lesson.id)) MaterialTheme.colorScheme.onSurface
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

@Composable
private fun FileSource(state: ReviewCreationState, viewModel: CreateReviewViewModel) {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let {
            var name = "Unknown"
            context.contentResolver.query(it, null, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) name = c.getString(idx)
                }
            }
            viewModel.setFile(it, name)
        }
    }

    Card(Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (state.selectedFileUri == null) {
                Icon(Icons.Filled.FileUpload, null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                Text("Upload PDF, DOCX, PPTX, or TXT", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { launcher.launch(arrayOf("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain")) }) {
                    Icon(Icons.Filled.FileUpload, null); Spacer(Modifier.width(8.dp)); Text("Select File")
                }
            } else {
                Icon(Icons.Filled.Description, null, modifier = Modifier.size(48.dp), tint = CognifyColors.ElectricViolet)
                Spacer(Modifier.height(8.dp))
                Text(state.selectedFileName, fontWeight = FontWeight.Medium)
                Text("${state.extractedText.take(100).length} chars", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { launcher.launch(arrayOf("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain")) }) { Text("Change") }
                    Button(onClick = { viewModel.extractFileContent() }, enabled = !state.isExtracting) {
                        if (state.isExtracting) { CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp); Spacer(Modifier.width(8.dp)) }
                        Text(if (state.isExtracting) "Extracting..." else "Extract Text")
                    }
                }
            }
        }
    }
}

@Composable
private fun TextSource(state: ReviewCreationState, viewModel: CreateReviewViewModel) {
    val context = LocalContext.current
    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { viewModel.addPhoto(it, "Photo ${state.photos.size + 1}") }
    }

    Card(Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
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
                    TextButton(onClick = { if (count > 3) onCountChange(count - 1) }, modifier = Modifier.size(28.dp).padding(0.dp)) { Text("-", fontWeight = FontWeight.Bold) }
                    Text("$count", fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp))
                    TextButton(onClick = { if (count < 30) onCountChange(count + 1) }, modifier = Modifier.size(28.dp).padding(0.dp)) { Text("+", fontWeight = FontWeight.Bold) }
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

    Column(modifier) {
        val safeIndex = selectedTab.coerceIn(0, tabs.lastIndex.coerceAtLeast(0))
        if (tabs.isNotEmpty()) {
            TabRow(
                selectedTabIndex = safeIndex,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = CognifyColors.ElectricViolet,
            ) {
                tabs.forEachIndexed { i, tab ->
                    Tab(selected = safeIndex == i, onClick = { selectedTab = i },
                        text = { Text("${tab.label} (${tab.count})", maxLines = 1, style = MaterialTheme.typography.labelLarge) })
                }
            }
            when (tabs.getOrNull(safeIndex)?.id) {
                "flashcards" -> FlashcardList(result.flashcards)
                "cloze" -> ClozeList(result.clozeItems)
                "practice" -> PracticeList(result.practiceQuestions)
                "summary" -> SummaryList(result.summarySections)
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
