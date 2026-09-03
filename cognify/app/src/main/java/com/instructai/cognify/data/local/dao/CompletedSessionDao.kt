package com.instructai.cognify.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.instructai.cognify.data.local.entity.CompletedSessionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CompletedSessionDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(session: CompletedSessionEntity): Long

    @Query("SELECT COUNT(*) FROM completed_sessions WHERE date_epoch_day = :epochDay")
    fun observeCountByDate(epochDay: Long): Flow<Int>
}
