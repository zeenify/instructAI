package com.instructai.cognify.ui.navigation

import java.net.URLEncoder

object Routes {
    const val LOGIN = "login"
    const val HOME = "home"
    const val REVIEWS = "reviews"
    const val CREATE_REVIEW = "create_review"
    const val SETTINGS = "settings"
    const val REVIEW_DETAIL = "review_detail/{reviewId}/{reviewTitle}"
    const val SET_PICKER = "set_picker/{reviewId}/{type}/{reviewTitle}"
    const val FLASHCARD_DECK = "flashcard_deck/{reviewId}/{setId}"
    const val CLOZE = "cloze/{reviewId}/{setId}"
    const val PRACTICE_TEST = "practice_test/{reviewId}/{setId}"
    const val SUMMARY = "summary/{reviewId}"
    const val STATS = "stats"
    const val VOICE_LAB = "voice_lab"

    fun reviewDetail(reviewId: Long, reviewTitle: String = "") =
        "review_detail/$reviewId/${URLEncoder.encode(reviewTitle, "UTF-8")}"
    fun setPicker(reviewId: Long, type: String, reviewTitle: String = "") =
        "set_picker/$reviewId/$type/${URLEncoder.encode(reviewTitle, "UTF-8")}"
    fun flashcardDeck(reviewId: Long, setId: Long? = null) = "flashcard_deck/$reviewId/${setId ?: -1L}"
    fun cloze(reviewId: Long, setId: Long? = null) = "cloze/$reviewId/${setId ?: -1L}"
    fun practiceTest(reviewId: Long, setId: Long? = null) = "practice_test/$reviewId/${setId ?: -1L}"
    fun summary(reviewId: Long) = "summary/$reviewId"
}
