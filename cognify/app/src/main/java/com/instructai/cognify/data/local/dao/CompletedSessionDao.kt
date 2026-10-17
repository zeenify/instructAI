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

    @Query("SELECT COUNT(*) FROM completed_sessions")
    fun observeTotalCount(): Flow<Int>

    @Query(
        """
        SELECT cs.review_id AS reviewId, cs.type AS type, cs.date_epoch_day AS dateEpochDay,
               cs.completed_at AS completedAt, r.title AS title
        FROM completed_sessions cs
        INNER JOIN reviews r ON r.id = cs.review_id
        ORDER BY cs.completed_at DESC
        LIMIT :limit
        """
    )
    fun observeRecentSessions(limit: Int): Flow<List<RecentSessionInfo>>
}

data class RecentSessionInfo(
    val reviewId: Long,
    val type: String,
    val dateEpochDay: Long,
    val completedAt: Long,
    val title: String,
)
