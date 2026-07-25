package com.instructai.cognify.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.repository.ApiMode
import com.instructai.cognify.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AiSettingsState(
    val apiMode: ApiMode = ApiMode.BACKEND,
    val groqApiKey: String = "",
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _isLoggedOut = MutableStateFlow(false)
    val isLoggedOut: StateFlow<Boolean> = _isLoggedOut.asStateFlow()

    private val _aiSettings = MutableStateFlow(AiSettingsState())
    val aiSettings: StateFlow<AiSettingsState> = _aiSettings.asStateFlow()

    init {
        viewModelScope.launch {
            tokenManager.apiMode.collect { mode ->
                _aiSettings.value = _aiSettings.value.copy(apiMode = mode)
            }
        }
        viewModelScope.launch {
            tokenManager.groqApiKey.collect { key ->
                _aiSettings.value = _aiSettings.value.copy(groqApiKey = key)
            }
        }
    }

    fun setApiMode(mode: ApiMode) {
        viewModelScope.launch {
            tokenManager.setApiMode(mode)
        }
    }

    fun setGroqApiKey(key: String) {
        _aiSettings.value = _aiSettings.value.copy(groqApiKey = key)
    }

    fun saveGroqApiKey() {
        viewModelScope.launch {
            tokenManager.setGroqApiKey(_aiSettings.value.groqApiKey)
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _isLoggedOut.value = true
        }
    }
}
