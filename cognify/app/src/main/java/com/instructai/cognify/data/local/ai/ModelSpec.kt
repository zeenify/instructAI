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
    private const val GEMMA_1B_URL =
        "https://storage.googleapis.com/mediapipe-assets/gemma_1b_int8.task"
    private const val GEMMA_3N_E2B_URL =
        "https://storage.googleapis.com/mediapipe-assets/gemma_3n_e2b_int8.task"
    private const val GEMMA_3N_E4B_URL =
        "https://storage.googleapis.com/mediapipe-assets/gemma_3n_e4b_int8.task"

    val LITE = ModelSpec(
        id = "gemma-1b",
        displayName = "Gemma 1B (Lite)",
        tier = ModelSpec.TIER_LITE,
        fileName = "gemma_1b_int8.task",
        downloadUrl = GEMMA_1B_URL,
        sizeBytes = 1_000_000_000L,
        ramEstimateGb = 2,
        maxTokens = 2048,
    )

    val STANDARD = ModelSpec(
        id = "gemma-3n-e2b",
        displayName = "Gemma 3n E2B (Standard)",
        tier = ModelSpec.TIER_STANDARD,
        fileName = "gemma_3n_e2b_int8.task",
        downloadUrl = GEMMA_3N_E2B_URL,
        sizeBytes = 3_000_000_000L,
        ramEstimateGb = 3,
        maxTokens = 4096,
    )

    val MAX = ModelSpec(
        id = "gemma-3n-e4b",
        displayName = "Gemma 3n E4B (Max)",
        tier = ModelSpec.TIER_MAX,
        fileName = "gemma_3n_e4b_int8.task",
        downloadUrl = GEMMA_3N_E4B_URL,
        sizeBytes = 6_000_000_000L,
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
