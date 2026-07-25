package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ReviewDto(
    @SerializedName("id") val id: Long,
    @SerializedName("title") val title: String,
    @SerializedName("source_type") val sourceType: String,
    @SerializedName("status") val status: String,
    @SerializedName("created_at") val createdAt: String,
)
