package com.instructai.cognify.data.local.ai

/**
 * On-device model registry for Local AI mode. All models are downloaded on
 * demand to filesDir/models/ — none ship inside the APK.
 *
 * Download URLs point at Google's official public .task files. If a link ever
 * dies, swap it here (e.g. to our own Cloudflare R2 bucket) — single place.
 */
data class ModelSpec(
    val id: String,
    val displayName: String,
    val tier: String,
    val fileName: String,
    val downloadUrl: String,
    val sizeBytes: Long,
    /** Rough RAM footprint while the model is loaded. */
    val ramEstimateGb: Int,
    val maxTokens: Int,
) {
    companion object {
        const val TIER_LITE = "lite"
        const val TIER_STANDARD = "standard"
        const val TIER_MAX = "max"
    }
}

object ModelRegistry {

    // To move hosting to our own bucket later, change only these URLs.
    // Verified working (ungated, ranged-GET resumable) as of 2026-09-04:
    private const val GEMMA_E2B_URL =
        "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task"
    private const val GEMMA_E4B_URL =
        "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.task"
    // The Gemma 3 1B .task is license-gated on HuggingFace (HTTP 401 without
    // a token). Pending self-hosting on our own bucket.
    private const val GEMMA_1B_URL =
        "https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/gemma3-1b-it-int4.task"

    val LITE = ModelSpec(
        id = "gemma-1b",
        displayName = "Gemma 1B (Lite)",
        tier = ModelSpec.TIER_LITE,
        fileName = "gemma3-1b-it-int4.task",
        downloadUrl = GEMMA_1B_URL,
        sizeBytes = 554_000_000L,
        ramEstimateGb = 2,
        maxTokens = 2048,
    )

    val STANDARD = ModelSpec(
        id = "gemma-4-e2b",
        displayName = "Gemma E2B (Standard)",
        tier = ModelSpec.TIER_STANDARD,
        fileName = "gemma-4-E2B-it-web.task",
        downloadUrl = GEMMA_E2B_URL,
        sizeBytes = 2_000_000_000L,
        ramEstimateGb = 3,
        maxTokens = 4096,
    )

    val MAX = ModelSpec(
        id = "gemma-4-e4b",
        displayName = "Gemma E4B (Max)",
        tier = ModelSpec.TIER_MAX,
        fileName = "gemma-4-E4B-it-web.task",
        downloadUrl = GEMMA_E4B_URL,
        sizeBytes = 3_000_000_000L,
        ramEstimateGb = 6,
        maxTokens = 4096,
    )

    val ALL = listOf(LITE, STANDARD, MAX)

    val DEFAULT = STANDARD

    fun byId(id: String): ModelSpec? = ALL.firstOrNull { it.id == id }

    /**
     * Recommended model tier for a device with [totalRamBytes] of RAM.
     * Budget phones (4GB) get Lite, most modern phones (6-8GB) get Standard,
     * flagships (12GB+) can use Max.
     */
    fun recommend(totalRamBytes: Long): ModelSpec = when {
        totalRamBytes >= 10L * 1024 * 1024 * 1024 -> MAX
        totalRamBytes >= 6L * 1024 * 1024 * 1024 -> STANDARD
        else -> LITE
    }
}
