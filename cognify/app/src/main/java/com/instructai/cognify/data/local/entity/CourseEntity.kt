package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "courses",
    foreignKeys = [
        ForeignKey(
            entity = ClassEntity::class,
            parentColumns = ["id"],
            childColumns = ["class_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("class_id")],
)
data class CourseEntity(
    @PrimaryKey val id: Long,
    @ColumnInfo(name = "class_id") val classId: Long,
    val title: String,
    val description: String?,
    @ColumnInfo(name = "is_published") val isPublished: Boolean,
    @ColumnInfo(name = "is_coding") val isCoding: Boolean,
    @ColumnInfo(name = "order_index") val orderIndex: Int,
    @ColumnInfo(name = "progress_percent") val progressPercent: Int = 0,
    @ColumnInfo(name = "synced_at") val syncedAt: Long = System.currentTimeMillis(),
)
