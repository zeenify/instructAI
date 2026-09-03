package com.instructai.cognify.ui.questions

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.CognifyGradients

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MissedQuestionsScreen(
    reviewId: Long,
    onBack: () -> Unit,
    viewModel: MissedQuestionsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(reviewId) {
        viewModel.load(reviewId)
    }

    if (state.isFinished) {
        MissedQuestionsResultScreen(
            score = state.score,
            maxScore = state.items.size,
            onRestart = { viewModel.reset() },
            onBack = onBack,
        )
        return
    }

    if (state.isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Loading questions...", style = MaterialTheme.typography.bodyLarge)
        }
        return
    }

    if (state.items.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Nothing missed!", style = MaterialTheme.typography.headlineSmall)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "No missed questions for this reviewer. Keep it up!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = onBack,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CognifyColors.ElectricViolet,
                    ),
                ) {
                    Text("Back")
                }
            }
        }
        return
    }

    val current = state.items[state.currentIndex]

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Missed Questions") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${state.currentIndex + 1} / ${state.items.size}",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    "Score: ${state.score}/${state.items.size}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { (state.currentIndex + 1).toFloat() / state.items.size.toFloat() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(50)),
                color = CognifyColors.ElectricViolet,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Spacer(modifier = Modifier.height(24.dp))

            when (current) {
                is MissedQuestion.Cloze -> ClozeCard(
                    item = current.item,
                    state = state,
                    onReveal = { viewModel.reveal() },
                    onSelfAssessment = { viewModel.reportSelfAssessment(it) },
                    onNext = { viewModel.next() },
                )
                is MissedQuestion.Practice -> PracticeCard(
                    item = current.item,
                    state = state,
                    onSelect = { viewModel.selectAnswer(it) },
                    onNext = { viewModel.next() },
                )
            }
        }
    }
}

@Composable
private fun ClozeCard(
    item: com.instructai.cognify.data.local.entity.ClozeEntity,
    state: MissedQuestionsState,
    onReveal: () -> Unit,
    onSelfAssessment: (Boolean) -> Unit,
    onNext: () -> Unit,
) {
    Column {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface,
            ),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Complete the sentence",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 1.sp,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = buildClozeText(
                            item.sentenceBefore,
                            item.blankAnswer,
                            item.sentenceAfter,
                            state.isRevealed,
                        ),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center,
                        lineHeight = 32.sp,
                    )
                    if (state.isRevealed) {
                        Spacer(modifier = Modifier.height(20.dp))
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = CognifyColors.Success.copy(alpha = 0.1f),
                            ),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Filled.Check,
                                    contentDescription = null,
                                    tint = CognifyColors.Success,
                                    modifier = Modifier.size(20.dp),
                                )
                                Spacer(modifier = Modifier.size(8.dp))
                                Text(
                                    text = item.blankAnswer,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = CognifyColors.Success,
                                )
                            }
                        }
                    }
                    if (item.hint.isNotEmpty() && !state.isRevealed) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Filled.Lightbulb,
                                contentDescription = null,
                                tint = CognifyColors.Gold,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(modifier = Modifier.size(6.dp))
                            Text(
                                text = "Hint: ${item.hint}",
                                style = MaterialTheme.typography.bodySmall,
                                color = CognifyColors.Gold,
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        when {
            !state.isRevealed -> TextButton(
                onClick = onReveal,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
            ) {
                Text(
                    "Reveal Answer",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = CognifyColors.ElectricViolet,
                )
            }
            !state.isAssessed -> Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Button(
                    onClick = { onSelfAssessment(false) },
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CognifyColors.Error.copy(alpha = 0.15f),
                    ),
                ) {
                    Icon(Icons.Filled.Close, contentDescription = null, tint = CognifyColors.Error)
                    Spacer(modifier = Modifier.size(6.dp))
                    Text("Missed It", color = CognifyColors.Error, fontWeight = FontWeight.SemiBold)
                }
                Button(
                    onClick = { onSelfAssessment(true) },
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CognifyColors.Success.copy(alpha = 0.15f),
                    ),
                ) {
                    Icon(Icons.Filled.Check, contentDescription = null, tint = CognifyColors.Success)
                    Spacer(modifier = Modifier.size(6.dp))
                    Text("Got It", color = CognifyColors.Success, fontWeight = FontWeight.SemiBold)
                }
            }
            else -> Button(
                onClick = onNext,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = CognifyColors.ElectricViolet,
                ),
            ) {
                Text("Continue", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun PracticeCard(
    item: com.instructai.cognify.data.local.entity.PracticeQuestionEntity,
    state: MissedQuestionsState,
    onSelect: (String) -> Unit,
    onNext: () -> Unit,
) {
    Column {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface,
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = "Question",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing = 1.sp,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = item.questionText,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            when (item.questionType) {
                "identification" -> {
                    var textAnswer by remember { mutableStateOf("") }
                    OutlinedTextField(
                        value = textAnswer,
                        onValueChange = { textAnswer = it },
                        placeholder = { Text("Type your answer...") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.isAnswered,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = {
                            if (textAnswer.isNotBlank() && !state.isAnswered) {
                                onSelect(textAnswer)
                            }
                        }),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CognifyColors.ElectricViolet,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                        ),
                    )
                    if (!state.isAnswered) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { onSelect(textAnswer) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CognifyColors.ElectricViolet,
                                disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            ),
                            enabled = textAnswer.isNotBlank(),
                        ) {
                            Text("Submit Answer", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                else -> {
                    parseOptions(item.options, item.questionType).forEach { option ->
                        MissedOptionButton(
                            text = option,
                            isSelected = state.selectedAnswer == option,
                            isCorrect = if (state.isAnswered) {
                                val cleaned = option.replace(Regex("^[A-Z]\\)\\s*"), "").trim()
                                val cleanedCorrect = item.correctAnswer.replace(Regex("^[A-Z]\\)\\s*"), "").trim()
                                cleaned.equals(cleanedCorrect, ignoreCase = true)
                            } else null,
                            enabled = !state.isAnswered,
                            onClick = { onSelect(option) },
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (state.isAnswered) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (state.isCorrect == true)
                        CognifyColors.Success.copy(alpha = 0.1f)
                    else CognifyColors.Error.copy(alpha = 0.1f),
                ),
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (state.isCorrect == true) Icons.Filled.Check else Icons.Filled.Close,
                            contentDescription = null,
                            tint = if (state.isCorrect == true) CognifyColors.Success else CognifyColors.Error,
                            modifier = Modifier.size(24.dp),
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = if (state.isCorrect == true) "Correct!" else "Incorrect",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = if (state.isCorrect == true) CognifyColors.Success else CognifyColors.Error,
                        )
                    }
                    if (state.isCorrect == false) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Correct answer: ${item.correctAnswer.replace(Regex("^[A-Z]\\)\\s*"), "").trim()}",
                            style = MaterialTheme.typography.bodySmall,
                            color = CognifyColors.Success,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onNext,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = CognifyColors.ElectricViolet,
                ),
            ) {
                Text("Next", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun MissedOptionButton(
    text: String,
    isSelected: Boolean,
    isCorrect: Boolean?,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val bgColor by animateColorAsState(
        targetValue = when {
            isCorrect == true -> CognifyColors.Success.copy(alpha = 0.15f)
            isCorrect == false && isSelected -> CognifyColors.Error.copy(alpha = 0.15f)
            isSelected -> CognifyColors.ElectricViolet.copy(alpha = 0.1f)
            else -> MaterialTheme.colorScheme.surface
        },
        animationSpec = tween(200),
        label = "bg",
    )

    val borderColor = when {
        isCorrect == true -> CognifyColors.Success
        isCorrect == false && isSelected -> CognifyColors.Error
        isSelected -> CognifyColors.ElectricViolet
        else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
    }

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        border = BorderStroke(1.dp, borderColor),
        enabled = enabled,
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(16.dp),
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
        )
    }
}

@Composable
private fun MissedQuestionsResultScreen(
    score: Int,
    maxScore: Int,
    onRestart: () -> Unit,
    onBack: () -> Unit,
) {
    val percentage = if (maxScore > 0) (score.toFloat() / maxScore * 100).toInt() else 0

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            percentage >= 80 -> CognifyGradients.success
                            percentage >= 50 -> CognifyGradients.gold
                            else -> CognifyGradients.error
                        }
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "${percentage}%",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "$score / $maxScore correct",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = when {
                    percentage >= 80 -> "Excellent!"
                    percentage >= 50 -> "Good effort!"
                    else -> "Keep practicing!"
                },
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(modifier = Modifier.height(40.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Button(
                    onClick = onBack,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Text("Done")
                }
                Button(
                    onClick = onRestart,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CognifyColors.ElectricViolet,
                    ),
                ) {
                    Icon(Icons.Filled.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("Try Again")
                }
            }
        }
    }
}

private fun buildClozeText(before: String, answer: String, after: String, revealed: Boolean): String {
    val blank = if (revealed) "___${answer}___" else "________"
    return "$before $blank $after"
}

private fun parseOptions(optionsJson: String, questionType: String? = null): List<String> {
    if (optionsJson.isBlank()) {
        return when (questionType) {
            "true_false" -> listOf("True", "False")
            else -> emptyList()
        }
    }
    val raw = try {
        com.google.gson.Gson().fromJson(optionsJson, Array<String>::class.java).toList()
    } catch (_: Exception) {
        val pipeSplit = optionsJson.split("|").map { it.trim() }.filter { it.isNotEmpty() }
        if (pipeSplit.size > 1) pipeSplit
        else optionsJson.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }
    return raw.map { it.replace(Regex("^[A-Z]\\)\\s*"), "").trim() }
}
