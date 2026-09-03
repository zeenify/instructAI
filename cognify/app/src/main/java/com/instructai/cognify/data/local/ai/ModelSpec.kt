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

    // Self-hosted on the user's GitHub releases (anonymous, Range/resume OK).
    private const val GEMMA_1B_URL =
        "https://github.com/zeenify/instructAI/releases/download/models-v1/gemma3-1b-it-int4.task"

    // Android-compatible .task files for bigger tiers (Gemma 3n / gemma-4
    // E2B/E4B) are license-gated upstream or web-format only. Re-add them
    // here once self-hosted (upload to the same release) or after a
    // LiteRT-LM runtime migration (ungated .litertlm files):
    //   E2B: https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm (web.task = NOT Android-compatible)
    //   1B q8: litert-community/Gemma3-1B-IT gemma3-1b-it-int8.task (gated)

    val LITE = ModelSpec(
        id = "gemma-1b",
        displayName = "Gemma 1B (Lite)",
        tier = ModelSpec.TIER_LITE,
        fileName = "gemma3-1b-it-int4.task",
        downloadUrl = GEMMA_1B_URL,
        sizeBytes = 554_661_243L,
        ramEstimateGb = 2,
        maxTokens = 2048,
    )

    val ALL = listOf(LITE)

    val DEFAULT = LITE

    fun byId(id: String): ModelSpec? = ALL.firstOrNull { it.id == id }

    /**
     * Best model for a device with [totalRamBytes] of RAM: the largest
     * model whose RAM estimate fits with ~2GB headroom for the system,
     * falling back to the smallest available.
     */
    fun recommend(totalRamBytes: Long): ModelSpec {
        val fits = ALL.filter {
            it.ramEstimateGb * 1_000_000_000L + 2_000_000_000L <= totalRamBytes
        }
        return fits.maxByOrNull { it.ramEstimateGb } ?: ALL.minByOrNull { it.ramEstimateGb }
        ?: DEFAULT
    }
}
