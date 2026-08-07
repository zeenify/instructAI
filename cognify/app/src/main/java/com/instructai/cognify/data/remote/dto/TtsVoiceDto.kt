package com.instructai.cognify.data.remote.dto

import com.google.gson.annotations.SerializedName

data class TtsVoiceDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("likes") val likes: Int = 0,
    @SerializedName("gain_db") val gainDb: Double = 0.0,
)

data class TtsVoicesResponse(
    @SerializedName("voices") val voices: List<TtsVoiceDto> = emptyList(),
)
