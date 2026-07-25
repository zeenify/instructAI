package com.instructai.cognify.ui.navigation

object Routes {
    const val LOGIN = "login"
    const val HOME = "home"
    const val REVIEWS = "reviews"
    const val CREATE_REVIEW = "create_review"
    const val SETTINGS = "settings"
    const val REVIEW_DETAIL = "review_detail/{reviewId}/{reviewTitle}"
    const val FLASHCARD_DECK = "flashcard_deck/{reviewId}"
    const val CLOZE = "cloze/{reviewId}"
    const val PRACTICE_TEST = "practice_test/{reviewId}"
    const val AUDIO = "audio/{reviewId}"
    const val STATS = "stats"

    fun reviewDetail(reviewId: Long, reviewTitle: String = "") =
        "review_detail/$reviewId/${java.net.URLEncoder.encode(reviewTitle, "UTF-8")}"
    fun flashcardDeck(reviewId: Long) = "flashcard_deck/$reviewId"
    fun cloze(reviewId: Long) = "cloze/$reviewId"
    fun practiceTest(reviewId: Long) = "practice_test/$reviewId"
    fun audio(reviewId: Long) = "audio/$reviewId"
}
