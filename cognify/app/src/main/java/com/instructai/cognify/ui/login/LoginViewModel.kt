package com.instructai.cognify.ui.login

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResultLauncher
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.repository.AuthRepository
import com.instructai.cognify.data.repository.LmsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isLoggedIn: Boolean = false,
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val lmsRepository: LmsRepository,
    private val logger: AppLogger,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private var signInLauncher: ActivityResultLauncher<Intent>? = null

    fun setSignInLauncher(launcher: ActivityResultLauncher<Intent>) {
        signInLauncher = launcher
    }

    fun updateEmail(email: String) {
        _uiState.value = _uiState.value.copy(email = email, errorMessage = null)
    }

    fun updatePassword(password: String) {
        _uiState.value = _uiState.value.copy(password = password, errorMessage = null)
    }

    fun login() {
        val state = _uiState.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _uiState.value = state.copy(errorMessage = "Please fill in all fields")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, errorMessage = null)
            val result = authRepository.login(state.email, state.password)
            result.fold(
                onSuccess = {
                    syncLmsData()
                    _uiState.value = _uiState.value.copy(isLoading = false, isLoggedIn = true)
                },
                onFailure = {
                    logger.log("LoginViewModel", "Login failed: ${it.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = it.message ?: "Login failed",
                    )
                },
            )
        }
    }

    fun signInWithGoogle(activity: Activity) {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken("293017598453-67m9kq9mcqamtlmvodi7i2uiod4h9141.apps.googleusercontent.com")
            .requestEmail()
            .build()

        val googleSignInClient: GoogleSignInClient = GoogleSignIn.getClient(activity, gso)

        googleSignInClient.signOut().addOnCompleteListener {
            val signInIntent = googleSignInClient.signInIntent
            signInLauncher?.launch(signInIntent)
        }
    }

    fun handleGoogleResult(data: Intent?) {
        viewModelScope.launch {
            try {
                val task = GoogleSignIn.getSignedInAccountFromIntent(data)
                val account = task.getResult(ApiException::class.java)
                val idToken = account?.idToken
                if (idToken != null) {
                    val result = authRepository.loginWithGoogle(idToken)
                    result.fold(
                        onSuccess = {
                            syncLmsData()
                            _uiState.value = _uiState.value.copy(isLoading = false, isLoggedIn = true)
                        },
                        onFailure = { error ->
                            logger.log("LoginViewModel", "Google login failed: ${error.message}")
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                errorMessage = error.message ?: "Google login failed",
                            )
                        },
                    )
                } else {
                    logger.log("LoginViewModel", "Google login: No ID token received")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = "No ID token received",
                    )
                }
            } catch (e: ApiException) {
                logger.log("LoginViewModel", "Google sign-in cancelled/user cancelled", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = "Google sign-in cancelled",
                )
            }
        }
    }

    fun checkAuth() {
        _uiState.value = _uiState.value.copy(isLoggedIn = authRepository.isLoggedIn())
    }

    private fun syncLmsData() {
        viewModelScope.launch {
            try {
                lmsRepository.syncAll()
            } catch (e: Exception) {
                logger.log("LoginViewModel", "Initial sync failed", e)
            }
        }
    }
}
