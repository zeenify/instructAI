package com.instructai.cognify.ui.flashcards

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun FlashcardDeckScreen(
    reviewId: Long,
    setId: Long? = null,
    onBack: () -> Unit,
    viewModel: FlashcardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(reviewId, setId) {
        viewModel.loadCards(reviewId, setId)
    }

    FlashcardSessionScreen(
        state = state,
        onRate = { card, isCorrect -> viewModel.rateCard(card, isCorrect) },
        onFlip = { viewModel.flipCard() },
        onRestart = { viewModel.resetSession() },
        onBack = onBack,
        title = "Flashcards",
    )
}
