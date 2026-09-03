package com.instructai.cognify.ui.flashcards

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun MissedFlashcardsScreen(
    reviewId: Long,
    onBack: () -> Unit,
    viewModel: FlashcardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(reviewId) {
        viewModel.loadMissedCards(reviewId)
    }

    FlashcardSessionScreen(
        state = state,
        onRate = { card, isCorrect -> viewModel.rateCard(card, isCorrect) },
        onFlip = { viewModel.flipCard() },
        onRestart = { viewModel.resetSession() },
        onBack = onBack,
        title = "Missed Flashcards",
        emptyTitle = "Nothing missed!",
        emptyMessage = "No missed flashcards for this reviewer. Keep it up!",
    )
}
