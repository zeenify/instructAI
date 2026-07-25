package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.instructai.cognify.data.local.entity.StudyStatsEntity

@Dao
interface StudyStatsDao {

    @Query("SELECT * FROM study_stats ORDER BY date_epoch_day DESC")
    suspend fun getAllStats(): List<StudyStatsEntity>

    @Query("SELECT * FROM study_stats WHERE date_epoch_day = :epochDay LIMIT 1")
    suspend fun getStatsByDate(epochDay: Long): StudyStatsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(stats: StudyStatsEntity): Long

    @Query("SELECT COALESCE(SUM(flashcards_reviewed), 0) FROM study_stats")
    suspend fun getTotalFlashcardsReviewed(): Int

    @Query("SELECT COALESCE(SUM(questions_answered), 0) FROM study_stats")
    suspend fun getTotalQuestionsAnswered(): Int

    @Query("SELECT DISTINCT date_epoch_day FROM study_stats ORDER BY date_epoch_day DESC")
    suspend fun getAllActiveDays(): List<Long>
}
