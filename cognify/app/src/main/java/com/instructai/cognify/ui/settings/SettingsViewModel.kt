package com.instructai.cognify.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.logging.LogEntry
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.repository.ApiMode
import com.instructai.cognify.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
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
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager,
    private val logger: AppLogger,
) : ViewModel() {

    private val _isLoggedOut = MutableStateFlow(false)
    val isLoggedOut: StateFlow<Boolean> = _isLoggedOut.asStateFlow()

    private val _aiSettings = MutableStateFlow(AiSettingsState())
    val aiSettings: StateFlow<AiSettingsState> = _aiSettings.asStateFlow()

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

    fun clearLogs() {
        logger.clear()
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _isLoggedOut.value = true
        }
    }
}
