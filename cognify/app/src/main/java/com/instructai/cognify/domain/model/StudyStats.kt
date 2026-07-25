package com.instructai.cognify.domain.model

data class StudyStats(
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val totalCardsReviewed: Int = 0,
    val totalCardsDue: Int = 0,
    val totalPracticeTests: Int = 0,
    val averageAccuracy: Float = 0f,
    val studyMinutesToday: Int = 0,
    val reviewsCreated: Int = 0,
)
