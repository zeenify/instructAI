package com.instructai.cognify.domain.model

data class Flashcard(
    val id: Long = 0,
    val reviewId: Long,
    val frontText: String,
    val backText: String,
    val tags: String = "",
    val difficulty: String = "medium",
    val easeFactor: Float = 2.5f,
    val intervalDays: Int = 0,
    val repetitions: Int = 0,
    val nextReviewAt: Long = System.currentTimeMillis(),
    val lastReviewedAt: Long? = null,
)
