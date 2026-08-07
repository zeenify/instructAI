package com.instructai.cognify.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.instructai.cognify.data.local.dao.ClassDao
import com.instructai.cognify.data.local.dao.ClozeDao
import com.instructai.cognify.data.local.dao.CourseDao
import com.instructai.cognify.data.local.dao.FlashcardDao
import com.instructai.cognify.data.local.dao.LessonDao
import com.instructai.cognify.data.local.dao.ModuleDao
import com.instructai.cognify.data.local.dao.PracticeQuestionDao
import com.instructai.cognify.data.local.dao.QuestionDao
import com.instructai.cognify.data.local.dao.QuizDao
import com.instructai.cognify.data.local.dao.ReviewDao
import com.instructai.cognify.data.local.dao.ReviewTtsDao
import com.instructai.cognify.data.local.dao.StudyStatsDao
import com.instructai.cognify.data.local.dao.TtsClipDao
import com.instructai.cognify.data.local.dao.UserDao
import com.instructai.cognify.data.local.entity.AttemptEntity
import com.instructai.cognify.data.local.entity.ClassEntity
import com.instructai.cognify.data.local.entity.ClozeEntity
import com.instructai.cognify.data.local.entity.CourseEntity
import com.instructai.cognify.data.local.entity.FlashcardEntity
import com.instructai.cognify.data.local.entity.FlashcardReviewEntity
import com.instructai.cognify.data.local.entity.LessonEntity
import com.instructai.cognify.data.local.entity.ModuleEntity
import com.instructai.cognify.data.local.entity.PracticeQuestionEntity
import com.instructai.cognify.data.local.entity.QuestionEntity
import com.instructai.cognify.data.local.entity.QuizEntity
import com.instructai.cognify.data.local.entity.ReviewEntity
import com.instructai.cognify.data.local.entity.ReviewTtsEntity
import com.instructai.cognify.data.local.entity.StudyStatsEntity
import com.instructai.cognify.data.local.entity.TtsClipEntity
import com.instructai.cognify.data.local.entity.UserEntity

@Database(
    entities = [
        ReviewEntity::class,
        ReviewTtsEntity::class,
        TtsClipEntity::class,
        FlashcardEntity::class,
        FlashcardReviewEntity::class,
        ClozeEntity::class,
        PracticeQuestionEntity::class,
        AttemptEntity::class,
        ClassEntity::class,
        CourseEntity::class,
        ModuleEntity::class,
        LessonEntity::class,
        QuizEntity::class,
        QuestionEntity::class,
        StudyStatsEntity::class,
        UserEntity::class,
    ],
    version = 6,
    exportSchema = false,
)
abstract class CognifyDatabase : RoomDatabase() {
    abstract fun reviewDao(): ReviewDao
    abstract fun reviewTtsDao(): ReviewTtsDao
    abstract fun ttsClipDao(): TtsClipDao
    abstract fun flashcardDao(): FlashcardDao
    abstract fun clozeDao(): ClozeDao
    abstract fun practiceQuestionDao(): PracticeQuestionDao
    abstract fun studyStatsDao(): StudyStatsDao
    abstract fun classDao(): ClassDao
    abstract fun courseDao(): CourseDao
    abstract fun moduleDao(): ModuleDao
    abstract fun lessonDao(): LessonDao
    abstract fun quizDao(): QuizDao
    abstract fun questionDao(): QuestionDao
    abstract fun userDao(): UserDao
}
