package com.instructai.cognify.data.local.ai

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import com.instructai.cognify.data.logging.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

sealed class LocalAiState {
    data object Off : LocalAiState()

    data class Downloading(
        val modelId: String,
        val progress: DownloadProgress? = null,
    ) : LocalAiState()

    data class Loading(val modelId: String) : LocalAiState()

    data class On(val modelId: String, val modelName: String) : LocalAiState()

    data class Error(val message: String) : LocalAiState()
}

/**
 * Owns the on-device LLM lifecycle behind a start/stop power button.
 *
 * The MediaPipe [LlmInference] engine holds multi-GB RAM while loaded; [stop]
 * calls close() and frees it all. [ensureStarted] powers up on demand when a
 * generation arrives, and an idle watchdog closes the engine after
 * [IDLE_TIMEOUT_MS] so the AI never drains the battery while the user isn't
 * generating.
 */
@Singleton
class LocalAiEngine @Inject constructor(
    @ApplicationContext private val context: Context,
    private val downloadManager: ModelDownloadManager,
    private val logger: AppLogger,
) {
    companion object {
        const val IDLE_TIMEOUT_MS = 10 * 60 * 1000L // 10 minutes
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _state = MutableStateFlow<LocalAiState>(LocalAiState.Off)
    val state: StateFlow<LocalAiState> = _state.asStateFlow()

    private val selectedModelRef = AtomicReference(ModelRegistry.DEFAULT)

    /** Currently selected model spec. */
    val currentModel: ModelSpec
        get() = selectedModelRef.get()

    private val inferenceRef = AtomicReference<LlmInference?>(null)
    private val litertEngineRef = AtomicReference<Engine?>(null)

    /** The spec whose engine is currently loaded — null when off. */
    @Volatile
    private var loadedSpec: ModelSpec? = null

    /** Serializes power-on attempts and prompt execution. */
    private val loadMutex = Mutex()
    private val generateMutex = Mutex()

    private var powerOnJob: Job? = null
    private var idleJob: Job? = null

    @Volatile
    private var lastActivityMs = System.currentTimeMillis()

    /**
     * Set the model that Start will load. Ignored while the engine is
     * powering up or already on — switching requires Stop first (the
     * Settings UI enforces this).
     */
    fun selectModel(spec: ModelSpec) {
        when (_state.value) {
            is LocalAiState.On, is LocalAiState.Loading, is LocalAiState.Downloading -> return
            else -> selectedModelRef.set(spec)
        }
    }

    /**
     * Power ON: download the selected model if missing, then load it into
     * RAM. Idempotent — concurrent callers wait for the same attempt to
     * finish. Returns success only when the engine is actually On.
     */
    suspend fun ensureStarted(): Result<Unit> {
        loadMutex.withLock {
            when (_state.value) {
                is LocalAiState.On -> return Result.success(Unit)
                is LocalAiState.Downloading, is LocalAiState.Loading -> {
                    // A power-on attempt is already running — just watch it.
                }
                is LocalAiState.Error, LocalAiState.Off -> startPowerOn()
            }
        }

        return when (val terminal = state.first { it !is LocalAiState.Downloading && it !is LocalAiState.Loading }) {
            is LocalAiState.On -> Result.success(Unit)
            is LocalAiState.Error -> Result.failure(IllegalStateException(terminal.message))
            else -> Result.failure(IllegalStateException("Local AI was powered off"))
        }
    }

    private fun startPowerOn() {
        val spec = currentModel
        val needsDownload = !downloadManager.isDownloaded(spec)
        // Mark the transient state synchronously so waiters can't observe a
        // stale Off from before this attempt.
        _state.value = if (needsDownload) {
            LocalAiState.Downloading(spec.id)
        } else {
            LocalAiState.Loading(spec.id)
        }
        powerOnJob?.cancel()
        powerOnJob = scope.launch { powerOnPipeline(spec, needsDownload) }
    }

    private suspend fun powerOnPipeline(spec: ModelSpec, needsDownload: Boolean) {
        try {
            if (needsDownload) {
                logger.log("LocalAiEngine", "Downloading model ${spec.id}…")
                var downloadError: String? = null
                try {
                    downloadManager.download(spec).collect { event ->
                        when (event) {
                            is DownloadEvent.Progress ->
                                _state.value = LocalAiState.Downloading(spec.id, event.progress)
                            is DownloadEvent.Done -> {}
                            is DownloadEvent.Failed -> downloadError = event.message
                        }
                    }
                } catch (e: CancellationException) {
                    throw e
                }
                if (downloadError != null) {
                    _state.value = LocalAiState.Error(
                        "Download failed: " + (downloadError?.lineSequence()?.first()?.take(160) ?: "unknown")
                    )
                    logger.log("LocalAiEngine", "Download ${spec.id} failed: $downloadError")
                    return
                }
                if (!downloadManager.isDownloaded(spec)) {
                    _state.value = LocalAiState.Error("Model file missing after download")
                    return
                }
            }

            _state.value = LocalAiState.Loading(spec.id)
            logger.log("LocalAiEngine", "Loading model ${spec.id} (${spec.runtime}) into RAM")

            val loadResult = withContext(Dispatchers.IO) {
                when (spec.runtime) {
                    ModelSpec.Runtime.MEDIAPIPE_TASK -> runCatching {
                        val inference = LlmInference.createFromOptions(
                            context,
                            LlmInference.LlmInferenceOptions.builder()
                                .setModelPath(downloadManager.modelFile(spec).absolutePath)
                                .setMaxTokens(spec.maxTokens)
                                .build(),
                        )
                        inferenceRef.getAndSet(null)?.close()
                        inferenceRef.set(inference)
                    }
                    ModelSpec.Runtime.LITERT_LM -> runCatching {
                        val engine = Engine(
                            EngineConfig(
                                modelPath = downloadManager.modelFile(spec).absolutePath,
                                backend = Backend.CPU(),
                                visionBackend = null,
                                audioBackend = null,
                                maxNumTokens = spec.maxTokens,
                                cacheDir = null,
                            )
                        )
                        engine.initialize()
                        litertEngineRef.getAndSet(null)?.close()
                        litertEngineRef.set(engine)
                    }
                }
            }

            loadResult.fold(
                onSuccess = {
                    loadedSpec = spec
                    _state.value = LocalAiState.On(spec.id, spec.displayName)
                    markActivity()
                    scheduleIdleWatchdog()
                    logger.log("LocalAiEngine", "Model ${spec.id} loaded — engine ON")
                },
                onFailure = { e ->
                    _state.value = LocalAiState.Error("Failed to load model: ${sanitizeError(e)}")
                    logger.log("LocalAiEngine", "Load ${spec.id} failed: ${e.message}", e)
                },
            )
        } catch (e: CancellationException) {
            // stop() cancelled this pipeline and already set Off.
            throw e
        } catch (e: Exception) {
            _state.value = LocalAiState.Error("Power on failed: ${sanitizeError(e)}")
            logger.log("LocalAiEngine", "Power on failed: ${e.message}", e)
        }
    }

    /**
     * MediaPipe exceptions carry multi-line internal source traces; surface
     * only the first line, trimmed, so the Settings status stays readable.
     * Full detail always goes to AppLogger.
     */
    private fun sanitizeError(e: Throwable): String =
        (e.message ?: e.toString())
            .lineSequence()
            .first()
            .replace(Regex("={3,}\\s*Source Location Trace.*"), "")
            .trim()
            .take(160)

    /**
     * Power OFF / universal cancel: unloads whichever runtime engine is
     * loaded (freeing all RAM) and cancels any in-flight download or load.
     */
    suspend fun stop() {
        powerOnJob?.cancel()
        powerOnJob = null
        idleJob?.cancel()
        idleJob = null
        val inference = inferenceRef.getAndSet(null)
        if (inference != null) {
            runCatching { withContext(Dispatchers.IO) { inference.close() } }
                .onFailure { logger.log("LocalAiEngine", "close() failed: ${it.message}") }
        }
        val litertEngine = litertEngineRef.getAndSet(null)
        if (litertEngine != null) {
            runCatching { withContext(Dispatchers.IO) { litertEngine.close() } }
                .onFailure { logger.log("LocalAiEngine", "litert close() failed: ${it.message}") }
        }
        loadedSpec = null
        _state.value = LocalAiState.Off
        logger.log("LocalAiEngine", "Engine OFF — RAM freed")
    }

    /**
     * Run one prompt through the loaded model, dispatching on whichever
     * runtime is powered. Serializes concurrent callers (both engines are
     * single-prompt-at-a-time). Sampling at temperature 0.7 — tiny models
     * go lazy/short under greedy decoding.
     */
    suspend fun generate(prompt: String): Result<String> = generateMutex.withLock {
        val spec = loadedSpec
            ?: return@withLock Result.failure(IllegalStateException("Local AI is off"))

        markActivity()
        val output = withContext(Dispatchers.IO) {
            when (spec.runtime) {
                ModelSpec.Runtime.MEDIAPIPE_TASK -> generateMediaPipe(prompt)
                ModelSpec.Runtime.LITERT_LM -> generateLiteRt(prompt)
            }
        }
        markActivity()

        output.onFailure { e ->
            logger.log("LocalAiEngine", "generateResponse failed: ${e.message}", e)
        }
        output
    }

    private fun generateMediaPipe(prompt: String): Result<String> {
        val inference = inferenceRef.get()
            ?: return Result.failure(IllegalStateException("Local AI is off"))
        return runCatching {
            LlmInferenceSession.createFromOptions(
                inference,
                LlmInferenceSession.LlmInferenceSessionOptions.builder()
                    .setTemperature(0.7f)
                    .setTopK(40)
                    .build(),
            ).use { session ->
                runCatching { logger.log("LocalAiEngine", "Prompt tokens: ${session.sizeInTokens(prompt)}") }
                session.addQueryChunk(prompt)
                session.generateResponse()
            }
        }
    }

    private fun generateLiteRt(prompt: String): Result<String> {
        val engine = litertEngineRef.get()
            ?: return Result.failure(IllegalStateException("Local AI is off"))
        return runCatching {
            engine.createConversation(
                ConversationConfig(
                    samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = 0.7),
                ),
            ).use { conversation ->
                val reply = conversation.sendMessage(Contents.of(listOf(Content.Text(prompt))))
                reply.toString()
            }
        }
    }

    /** True when the engine is loaded and prompts can run right now. */
    fun isOn(): Boolean = loadedSpec != null

    private fun markActivity() {
        lastActivityMs = System.currentTimeMillis()
    }

    private fun scheduleIdleWatchdog() {
        idleJob?.cancel()
        idleJob = scope.launch {
            while (true) {
                delay(60_000L)
                if (System.currentTimeMillis() - lastActivityMs >= IDLE_TIMEOUT_MS) {
                    logger.log("LocalAiEngine", "Idle ${IDLE_TIMEOUT_MS / 60000} min — auto power off")
                    stop()
                    break
                }
            }
        }
    }

    /** Called by DI teardown; not relied on in practice. */
    fun shutdown() {
        val inference = inferenceRef.getAndSet(null)
        runCatching { inference?.close() }
        val litertEngine = litertEngineRef.getAndSet(null)
        runCatching { litertEngine?.close() }
        scope.cancel()
    }
}
