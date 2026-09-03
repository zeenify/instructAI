package com.instructai.cognify.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "cloze_items",
    foreignKeys = [
        ForeignKey(
            entity = ReviewEntity::class,
            parentColumns = ["id"],
            childColumns = ["review_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("review_id"), Index("review_id", "set_id")],
)
data class ClozeEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "review_id") val reviewId: Long,
    @ColumnInfo(name = "set_id") val setId: Long? = null,
    @ColumnInfo(name = "sentence_before") val sentenceBefore: String,
    @ColumnInfo(name = "blank_answer") val blankAnswer: String,
    @ColumnInfo(name = "sentence_after") val sentenceAfter: String = "",
    @ColumnInfo(name = "hint") val hint: String = "",
    @ColumnInfo(name = "order_index") val orderIndex: Int = 0,
)
