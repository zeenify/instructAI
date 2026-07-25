package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "modules",
    foreignKeys = [
        ForeignKey(
            entity = CourseEntity::class,
            parentColumns = ["id"],
            childColumns = ["course_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("course_id")],
)
data class ModuleEntity(
    @PrimaryKey val id: Long,
    @ColumnInfo(name = "course_id") val courseId: Long,
    val title: String,
    @ColumnInfo(name = "order_index") val orderIndex: Int,
    @ColumnInfo(name = "is_published") val isPublished: Boolean,
    @ColumnInfo(name = "synced_at") val syncedAt: Long = System.currentTimeMillis(),
)
