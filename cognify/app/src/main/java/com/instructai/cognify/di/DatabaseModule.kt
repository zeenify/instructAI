package com.instructai.cognify.di

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.instructai.cognify.data.local.CognifyDatabase
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
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private val MIGRATION_4_5 = object : Migration(4, 5) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `review_tts` (" +
                    "`review_id` INTEGER NOT NULL, " +
                    "`character_id` TEXT NOT NULL, " +
                    "`paragraphs_json` TEXT NOT NULL, " +
                    "`status` TEXT NOT NULL, " +
                    "`created_at` INTEGER NOT NULL, " +
                    "`updated_at` INTEGER NOT NULL, " +
                    "PRIMARY KEY(`review_id`, `character_id`))"
            )
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `tts_clips` (" +
                    "`review_id` INTEGER NOT NULL, " +
                    "`character_id` TEXT NOT NULL, " +
                    "`paragraph_index` INTEGER NOT NULL, " +
                    "`voice_id` TEXT NOT NULL, " +
                    "`text_hash` TEXT NOT NULL, " +
                    "`file_path` TEXT, " +
                    "`duration_ms` INTEGER, " +
                    "`status` TEXT NOT NULL, " +
                    "`created_at` INTEGER NOT NULL, " +
                    "PRIMARY KEY(`review_id`, `character_id`, `paragraph_index`, `voice_id`))"
            )
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_tts_clips_review_id_character_id` " +
                    "ON `tts_clips` (`review_id`, `character_id`)"
            )
        }
    }

    private val MIGRATION_5_6 = object : Migration(5, 6) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `tts_clips_new` (" +
                    "`review_id` INTEGER NOT NULL, " +
                    "`character_id` TEXT NOT NULL, " +
                    "`sentence_index` INTEGER NOT NULL, " +
                    "`voice_id` TEXT NOT NULL, " +
                    "`text_hash` TEXT NOT NULL, " +
                    "`file_path` TEXT, " +
                    "`duration_ms` INTEGER, " +
                    "`status` TEXT NOT NULL, " +
                    "`created_at` INTEGER NOT NULL, " +
                    "PRIMARY KEY(`review_id`, `character_id`, `sentence_index`, `voice_id`))"
            )
            db.execSQL("DROP TABLE IF EXISTS `tts_clips`")
            db.execSQL("ALTER TABLE `tts_clips_new` RENAME TO `tts_clips`")
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_tts_clips_review_id_character_id` " +
                    "ON `tts_clips` (`review_id`, `character_id`)"
            )
            db.execSQL("ALTER TABLE `review_tts` ADD COLUMN `sentences_json` TEXT NOT NULL DEFAULT ''")
            db.execSQL("DELETE FROM `review_tts`")
        }
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): CognifyDatabase {
        return Room.databaseBuilder(
            context,
            CognifyDatabase::class.java,
            "cognify_db",
        )
            .addMigrations(MIGRATION_4_5, MIGRATION_5_6)
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides fun provideReviewDao(db: CognifyDatabase): ReviewDao = db.reviewDao()
    @Provides fun provideReviewTtsDao(db: CognifyDatabase): ReviewTtsDao = db.reviewTtsDao()
    @Provides fun provideTtsClipDao(db: CognifyDatabase): TtsClipDao = db.ttsClipDao()
    @Provides fun provideFlashcardDao(db: CognifyDatabase): FlashcardDao = db.flashcardDao()
    @Provides fun provideClozeDao(db: CognifyDatabase): ClozeDao = db.clozeDao()
    @Provides fun providePracticeQuestionDao(db: CognifyDatabase): PracticeQuestionDao = db.practiceQuestionDao()
    @Provides fun provideStudyStatsDao(db: CognifyDatabase): StudyStatsDao = db.studyStatsDao()
    @Provides fun provideClassDao(db: CognifyDatabase): ClassDao = db.classDao()
    @Provides fun provideCourseDao(db: CognifyDatabase): CourseDao = db.courseDao()
    @Provides fun provideModuleDao(db: CognifyDatabase): ModuleDao = db.moduleDao()
    @Provides fun provideLessonDao(db: CognifyDatabase): LessonDao = db.lessonDao()
    @Provides fun provideQuizDao(db: CognifyDatabase): QuizDao = db.quizDao()
    @Provides fun provideQuestionDao(db: CognifyDatabase): QuestionDao = db.questionDao()
    @Provides fun provideUserDao(db: CognifyDatabase): UserDao = db.userDao()
}
