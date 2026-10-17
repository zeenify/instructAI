package com.instructai.cognify.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.local.CognifyDatabase
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.prefs.ThemeMode
import com.instructai.cognify.data.prefs.ThemePreferences
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.repository.ApiMode
import com.instructai.cognify.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class UserInfo(
    val name: String,
    val email: String,
)

data class AiSettingsState(
    val apiMode: ApiMode = ApiMode.BACKEND,
    val directApiKey: String = "",
    val serverUrl: String = "",
    val serverHost: String = "",
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager,
    private val themePreferences: ThemePreferences,
    private val database: CognifyDatabase,
    private val logger: AppLogger,
) : ViewModel() {

    private val _isLoggedOut = MutableStateFlow(false)
    val isLoggedOut: StateFlow<Boolean> = _isLoggedOut.asStateFlow()

    private val _aiSettings = MutableStateFlow(AiSettingsState())
    val aiSettings: StateFlow<AiSettingsState> = _aiSettings.asStateFlow()

    private val _themeMode = MutableStateFlow(ThemeMode.SYSTEM)
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    private val _isClearingData = MutableStateFlow(false)
    val isClearingData: StateFlow<Boolean> = _isClearingData.asStateFlow()

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
                if (mode == ApiMode.LOCAL) {
                    // The on-device mode has no Settings surface anymore; a stale
                    // "local" preference would silently fail generation — fall back.
                    tokenManager.setApiMode(ApiMode.BACKEND)
                } else {
                    _aiSettings.value = _aiSettings.value.copy(apiMode = mode)
                }
            }
        }
        viewModelScope.launch {
            tokenManager.directApiKey.collect { key ->
                _aiSettings.value = _aiSettings.value.copy(directApiKey = key)
            }
        }
        viewModelScope.launch {
            tokenManager.serverUrlFlow.collect { url ->
                _aiSettings.value = _aiSettings.value.copy(
                    serverUrl = url,
                    serverHost = runCatching { java.net.URI(url).host ?: url }.getOrDefault(url),
                )
            }
        }
        viewModelScope.launch {
            themePreferences.themeMode.collect { mode ->
                _themeMode.value = mode
            }
        }
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch {
            themePreferences.setThemeMode(mode)
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

    fun clearAllData() {
        viewModelScope.launch {
            _isClearingData.value = true
            try {
                withContext(Dispatchers.IO) {
                    database.clearAllTables()
                }
                logger.clear()
            } catch (e: Exception) {
                logger.log("SettingsViewModel", "clearAllData failed", e)
            } finally {
                _isClearingData.value = false
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _isLoggedOut.value = true
        }
    }
}
