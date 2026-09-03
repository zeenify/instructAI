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
import com.instructai.cognify.data.local.dao.ReviewSetDao
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

    private val MIGRATION_6_7 = object : Migration(6, 7) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `review_sets` (" +
                    "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                    "`review_id` INTEGER NOT NULL, " +
                    "`type` TEXT NOT NULL, " +
                    "`name` TEXT NOT NULL, " +
                    "`created_at` INTEGER NOT NULL, " +
                    "FOREIGN KEY(`review_id`) REFERENCES `reviews`(`id`) " +
                    "ON UPDATE NO ACTION ON DELETE CASCADE)"
            )
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_review_sets_review_id` ON `review_sets` (`review_id`)"
            )
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_review_sets_review_id_type` ON `review_sets` (`review_id`, `type`)"
            )
            db.execSQL("ALTER TABLE `flashcards` ADD COLUMN `set_id` INTEGER")
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_flashcards_review_id_set_id` " +
                    "ON `flashcards` (`review_id`, `set_id`)"
            )
            db.execSQL("ALTER TABLE `cloze_items` ADD COLUMN `set_id` INTEGER")
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_cloze_items_review_id_set_id` " +
                    "ON `cloze_items` (`review_id`, `set_id`)"
            )
            db.execSQL("ALTER TABLE `practice_questions` ADD COLUMN `set_id` INTEGER")
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_practice_questions_review_id_set_id` " +
                    "ON `practice_questions` (`review_id`, `set_id`)"
            )
        }
    }

    private val MIGRATION_7_8 = object : Migration(7, 8) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `missed_items` (" +
                    "`review_id` INTEGER NOT NULL, " +
                    "`item_type` TEXT NOT NULL, " +
                    "`item_id` INTEGER NOT NULL, " +
                    "`missed_at` INTEGER NOT NULL, " +
                    "PRIMARY KEY(`review_id`, `item_type`, `item_id`), " +
                    "FOREIGN KEY(`review_id`) REFERENCES `reviews`(`id`) " +
                    "ON UPDATE NO ACTION ON DELETE CASCADE)"
            )
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_missed_items_review_id` " +
                    "ON `missed_items` (`review_id`)"
            )
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS `index_missed_items_review_id_item_type` " +
                    "ON `missed_items` (`review_id`, `item_type`)"
            )
        }
    }

    private val MIGRATION_8_9 = object : Migration(8, 9) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("DROP TABLE IF EXISTS `missed_items`")
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
            .addMigrations(MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7, MIGRATION_7_8, MIGRATION_8_9)
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides fun provideReviewDao(db: CognifyDatabase): ReviewDao = db.reviewDao()
    @Provides fun provideReviewSetDao(db: CognifyDatabase): ReviewSetDao = db.reviewSetDao()
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
