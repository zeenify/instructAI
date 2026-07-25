package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class QuizResponse(
    val quiz: QuizDetailDto,
    @SerializedName("class_id") val classId: Long,
    @SerializedName("existing_result") val existingResult: QuizResultDto?,
    @SerializedName("attempt_id") val attemptId: Long?,
)

data class QuizDetailDto(
    val id: Long,
    @SerializedName("module_id") val moduleId: Long,
    val title: String,
    @SerializedName("is_randomized") val isRandomized: Boolean,
    @SerializedName("ai_enabled") val aiEnabled: Boolean,
    @SerializedName("time_limit_minutes") val timeLimitMinutes: Int?,
    @SerializedName("order_index") val orderIndex: Int,
    @SerializedName("passing_score") val passingScore: Int,
    @SerializedName("is_published") val isPublished: Boolean,
    @SerializedName("timer_mode") val timerMode: String,
    @SerializedName("question_limit") val questionLimit: Int?,
    val questions: List<QuestionDto>,
)

data class QuestionDto(
    val id: Long,
    @SerializedName("quiz_id") val quizId: Long,
    @SerializedName("question_text") val questionText: String,
    val type: String,
    val options: Map<String, String>?,
    val points: Int,
    val boilerplate: String?,
)

data class QuizResultDto(
    val score: Int,
    @SerializedName("max_score") val maxScore: Int,
    val details: List<AnswerDetailDto>,
)

data class AnswerDetailDto(
    @SerializedName("question_id") val questionId: Long,
    @SerializedName("question_text") val questionText: String,
    val type: String,
    @SerializedName("is_correct") val isCorrect: Boolean,
    @SerializedName("correct_answer") val correctAnswer: String,
    @SerializedName("student_answer_text") val studentAnswerText: String?,
)
