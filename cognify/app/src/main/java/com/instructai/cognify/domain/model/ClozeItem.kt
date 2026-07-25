package com.instructai.cognify.domain.model

data class ClozeItem(
    val id: Long = 0,
    val reviewId: Long,
    val sentenceBefore: String,
    val blankAnswer: String,
    val sentenceAfter: String = "",
    val hint: String = "",
    val orderIndex: Int = 0,
) {
    val fullSentence: String
        get() = "$sentenceBefore ___ $sentenceAfter"
}
