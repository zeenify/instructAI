package com.instructai.cognify.data.local.ai

/**
 * On-device model registry for Local AI mode. All models are downloaded on
 * demand to filesDir/models/ — none ship inside the APK.
 *
 * Two runtimes:
 *  - MEDIAPIPE_TASK: MediaPipe LlmInference, loads .task files (Gemma 3-era).
 *  - LITERT_LM: Google's newer LiteRT-LM engine, loads .litertlm files
 *    (gemma-4 era, GPU/NPU-capable). The gemma-4 files on HuggingFace's
 *    litert-community org are ungated (anonymous, Range-resumable downloads).
 *
 * Download URLs: E2B/E4B point at the official litert-community repos
 * (verified ungated). The 1B .task is self-hosted on the user's GitHub
 * releases since its upstream is license-gated. Swap URLs here only.
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
    val runtime: Runtime,
) {
    enum class Runtime { MEDIAPIPE_TASK, LITERT_LM }

    companion object {
        const val TIER_LITE = "lite"
        const val TIER_STANDARD = "standard"
        const val TIER_MAX = "max"
    }
}

object ModelRegistry {

    private const val GEMMA_1B_URL =
        "https://github.com/zeenify/instructAI/releases/download/models-v1/gemma3-1b-it-int4.task"
    private const val GEMMA_E2B_URL =
        "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm"
    private const val GEMMA_E4B_URL =
        "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm"

    val LITE = ModelSpec(
        id = "gemma-1b",
        displayName = "Gemma 1B (Lite)",
        tier = ModelSpec.TIER_LITE,
        fileName = "gemma3-1b-it-int4.task",
        downloadUrl = GEMMA_1B_URL,
        sizeBytes = 554_661_243L,
        ramEstimateGb = 2,
        maxTokens = 2048,
        runtime = ModelSpec.Runtime.MEDIAPIPE_TASK,
    )

    val STANDARD = ModelSpec(
        id = "gemma-4-e2b",
        displayName = "Gemma E2B (Standard)",
        tier = ModelSpec.TIER_STANDARD,
        fileName = "gemma-4-E2B-it.litertlm",
        downloadUrl = GEMMA_E2B_URL,
        sizeBytes = 2_600_000_000L,
        ramEstimateGb = 3,
        maxTokens = 4096,
        runtime = ModelSpec.Runtime.LITERT_LM,
    )

    val MAX = ModelSpec(
        id = "gemma-4-e4b",
        displayName = "Gemma E4B (Max)",
        tier = ModelSpec.TIER_MAX,
        fileName = "gemma-4-E4B-it.litertlm",
        downloadUrl = GEMMA_E4B_URL,
        sizeBytes = 3_700_000_000L,
        ramEstimateGb = 6,
        maxTokens = 4096,
        runtime = ModelSpec.Runtime.LITERT_LM,
    )

    val ALL = listOf(LITE, STANDARD, MAX)

    val DEFAULT = STANDARD

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
