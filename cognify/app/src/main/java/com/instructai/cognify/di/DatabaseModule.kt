package com.instructai.cognify.di

import android.content.Context
import androidx.room.Room
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
import com.instructai.cognify.data.local.dao.StudyStatsDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): CognifyDatabase {
        return Room.databaseBuilder(
            context,
            CognifyDatabase::class.java,
            "cognify_db",
        ).fallbackToDestructiveMigration().build()
    }

    @Provides fun provideReviewDao(db: CognifyDatabase): ReviewDao = db.reviewDao()
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
}
