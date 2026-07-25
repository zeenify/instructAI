package com.instructai.cognify.domain.model

data class Review(
    val id: Long = 0,
    val serverId: Long? = null,
    val title: String,
    val sourceType: String,
    val contentText: String = "",
    val studyGuide: String = "",
    val status: String = "draft",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val synced: Boolean = false,
    val flashcardCount: Int = 0,
    val clozeCount: Int = 0,
    val questionCount: Int = 0,
)
