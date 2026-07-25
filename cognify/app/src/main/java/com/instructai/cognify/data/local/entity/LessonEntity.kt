package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "lessons",
    foreignKeys = [
        ForeignKey(
            entity = ModuleEntity::class,
            parentColumns = ["id"],
            childColumns = ["module_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("module_id")],
)
data class LessonEntity(
    @PrimaryKey val id: Long,
    @ColumnInfo(name = "module_id") val moduleId: Long,
    val title: String,
    val content: String?,
    @ColumnInfo(name = "order_index") val orderIndex: Int,
    @ColumnInfo(name = "is_published") val isPublished: Boolean,
    @ColumnInfo(name = "ai_enabled") val aiEnabled: Boolean,
    @ColumnInfo(name = "is_completed") val isCompleted: Boolean = false,
    @ColumnInfo(name = "synced_at") val syncedAt: Long = System.currentTimeMillis(),
)
