package com.instructai.cognify.ui.settings

import android.app.ActivityManager
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.BuildConfig
import com.instructai.cognify.data.local.ai.LocalAiEngine
import com.instructai.cognify.data.local.ai.LocalAiState
import com.instructai.cognify.data.local.ai.ModelDownloadManager
import com.instructai.cognify.data.local.ai.ModelRegistry
import com.instructai.cognify.data.local.ai.ModelSpec
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.logging.LogEntry
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.repository.ApiMode
import com.instructai.cognify.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UserInfo(
    val name: String,
    val email: String,
)

data class AiSettingsState(
    val apiMode: ApiMode = ApiMode.GEMINI,
    val directApiKey: String = "",
    val serverUrl: String = BuildConfig.API_BASE_URL,
    val manualServerUrl: String? = null,
)

data class LocalAiCardState(
    val engineState: LocalAiState = LocalAiState.Off,
    val selectedModelId: String = ModelRegistry.DEFAULT.id,
    /** modelId -> downloaded bytes on disk (0 = not downloaded). */
    val downloadedModels: Map<String, Long> = emptyMap(),
    val recommendedModelId: String = ModelRegistry.DEFAULT.id,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager,
    private val localAiEngine: LocalAiEngine,
    private val downloadManager: ModelDownloadManager,
    private val logger: AppLogger,
    @ApplicationContext private val appContext: Context,
) : ViewModel() {

    private val _isLoggedOut = MutableStateFlow(false)
    val isLoggedOut: StateFlow<Boolean> = _isLoggedOut.asStateFlow()

    private val _aiSettings = MutableStateFlow(AiSettingsState())
    val aiSettings: StateFlow<AiSettingsState> = _aiSettings.asStateFlow()

    private val _localAi = MutableStateFlow(LocalAiCardState())
    val localAi: StateFlow<LocalAiCardState> = _localAi.asStateFlow()

    private val _errorLogs = MutableStateFlow<List<LogEntry>>(emptyList())
    val errorLogs: StateFlow<List<LogEntry>> = _errorLogs.asStateFlow()

    val user: UserInfo?
        get() {
            val u = authRepository.currentUser ?: return null
            val name = when (u.role) {
                "student" -> u.studentProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
                else -> u.teacherProfile?.let { "${it.firstName} ${it.lastName}" }?.trim()
            }
            return UserInfo(name = name ?: u.email.substringBefore("@"), email = u.email)
        }

    init {
        viewModelScope.launch {
            authRepository.ensureSession()
        }
        viewModelScope.launch {
            tokenManager.apiMode.collect { mode ->
                _aiSettings.value = _aiSettings.value.copy(apiMode = mode)
            }
        }
        viewModelScope.launch {
            tokenManager.directApiKey.collect { key ->
                _aiSettings.value = _aiSettings.value.copy(directApiKey = key)
            }
        }
        viewModelScope.launch {
            tokenManager.serverUrlFlow.collect { url ->
                _aiSettings.value = _aiSettings.value.copy(serverUrl = url)
            }
        }
        viewModelScope.launch {
            tokenManager.manualServerUrlFlow.collect { url ->
                _aiSettings.value = _aiSettings.value.copy(manualServerUrl = url)
            }
        }
        viewModelScope.launch {
            val recommended = recommendedModel().id
            tokenManager.localModelId.collect { id ->
                // Keep the engine's selection in sync with what's persisted.
                ModelRegistry.byId(id)?.let { localAiEngine.selectModel(it) }
                _localAi.value = _localAi.value.copy(
                    selectedModelId = id,
                    recommendedModelId = recommended,
                )
            }
        }
        viewModelScope.launch {
            localAiEngine.state.collect { engine ->
                _localAi.value = _localAi.value.copy(
                    engineState = engine,
                    downloadedModels = snapshotDownloads(),
                )
            }
        }
        viewModelScope.launch {
            logger.getLogsFlow().collect { logs ->
                _errorLogs.value = logs
            }
        }
    }

    fun setApiMode(mode: ApiMode) {
        viewModelScope.launch {
            tokenManager.setApiMode(mode)
        }
    }

    fun setDirectApiKey(key: String) {
        _aiSettings.value = _aiSettings.value.copy(directApiKey = key)
    }

    fun saveDirectApiKey() {
        viewModelScope.launch {
            tokenManager.setDirectApiKey(_aiSettings.value.directApiKey)
        }
    }

    fun setServerUrl(url: String) {
        viewModelScope.launch {
            tokenManager.setServerUrl(url)
        }
    }

    fun clearServerUrl() {
        viewModelScope.launch {
            tokenManager.clearManualServerUrl()
        }
    }

    fun clearLogs() {
        logger.clear()
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _isLoggedOut.value = true
        }
    }

    // ---- Local AI ----

    /** Power ON — download if needed, load into RAM. */
    fun startLocalAi() {
        viewModelScope.launch {
            localAiEngine.ensureStarted()
        }
    }

    /** Power OFF — free RAM immediately. */
    fun stopLocalAi() {
        viewModelScope.launch {
            localAiEngine.stop()
            _localAi.value = _localAi.value.copy(downloadedModels = snapshotDownloads())
        }
    }

    /** Pick which model Start will use (ignored while engine is on). */
    fun selectLocalModel(spec: ModelSpec) {
        viewModelScope.launch {
            tokenManager.setLocalModelId(spec.id)
            localAiEngine.selectModel(spec)
            _localAi.value = _localAi.value.copy(selectedModelId = spec.id)
        }
    }

    /** Remove a downloaded model file. Blocks if that model is running. */
    fun deleteLocalModel(spec: ModelSpec) {
        viewModelScope.launch {
            localAiEngine.stop()
            downloadManager.deleteModel(spec)
            _localAi.value = _localAi.value.copy(downloadedModels = snapshotDownloads())
        }
    }

    private fun snapshotDownloads(): Map<String, Long> =
        ModelRegistry.ALL.associate { spec ->
            spec.id to (downloadManager.modelFile(spec).takeIf { it.exists() }?.length() ?: 0L)
        }

    private fun recommendedModel(): ModelSpec {
        val am = appContext.getSystemService(ActivityManager::class.java) ?: return ModelRegistry.DEFAULT
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        return if (info.totalMem > 0) ModelRegistry.recommend(info.totalMem) else ModelRegistry.DEFAULT
    }
}
