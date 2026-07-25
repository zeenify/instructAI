package com.instructai.cognify.data.remote

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.instructai.cognify.data.repository.ApiMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

private val TOKEN_KEY = stringPreferencesKey("auth_token")
private val API_MODE_KEY = stringPreferencesKey("api_mode")
private val GROQ_KEY_KEY = stringPreferencesKey("groq_api_key")

@Singleton
class TokenManager @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {

    @Volatile
    var token: String? = null
        private set

    init {
        token = runBlocking {
            dataStore.data.first()[TOKEN_KEY]
        }
    }

    val tokenFlow: Flow<String?> = dataStore.data.map { prefs ->
        prefs[TOKEN_KEY]
    }

    val apiMode: Flow<ApiMode> = dataStore.data.map { prefs ->
        val mode = prefs[API_MODE_KEY] ?: "backend"
        if (mode == "byok") ApiMode.BYOK else ApiMode.BACKEND
    }

    val groqApiKey: Flow<String> = dataStore.data.map { prefs ->
        prefs[GROQ_KEY_KEY] ?: ""
    }

    suspend fun saveToken(newToken: String) {
        token = newToken
        dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = newToken
        }
    }

    suspend fun clearToken() {
        token = null
        dataStore.edit { prefs ->
            prefs.remove(TOKEN_KEY)
        }
    }

    suspend fun hasToken(): Boolean {
        return dataStore.data.first().contains(TOKEN_KEY)
    }

    fun hasTokenSync(): Boolean = token != null

    suspend fun setApiMode(mode: ApiMode) {
        dataStore.edit { prefs ->
            prefs[API_MODE_KEY] = if (mode == ApiMode.BYOK) "byok" else "backend"
        }
    }

    suspend fun setGroqApiKey(key: String) {
        dataStore.edit { prefs ->
            prefs[GROQ_KEY_KEY] = key
        }
    }
}
