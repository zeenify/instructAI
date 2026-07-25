package com.instructai.cognify.domain.model

data class PracticeQuestion(
    val id: Long = 0,
    val reviewId: Long,
    val questionType: String,
    val questionText: String,
    val options: List<String> = emptyList(),
    val correctAnswer: String,
    val explanation: String = "",
    val orderIndex: Int = 0,
)

data class QuestionResult(
    val questionId: Long,
    val selectedAnswer: String,
    val isCorrect: Boolean,
    val correctAnswer: String,
    val explanation: String,
)
