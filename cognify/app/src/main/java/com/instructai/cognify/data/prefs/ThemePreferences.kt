package com.instructai.cognify.data.prefs

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/** User-facing appearance choice. SYSTEM follows the OS, like iOS. */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

@Singleton
class ThemePreferences @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {
    val themeMode: Flow<ThemeMode> = dataStore.data.map { prefs ->
        when (prefs[KEY]) {
            "light" -> ThemeMode.LIGHT
            "dark" -> ThemeMode.DARK
            else -> ThemeMode.SYSTEM
        }
    }

    suspend fun current(): ThemeMode = themeMode.first()

    suspend fun setThemeMode(mode: ThemeMode) {
        dataStore.edit { prefs ->
            prefs[KEY] = mode.name.lowercase()
        }
    }

    private companion object {
        val KEY = stringPreferencesKey("theme_mode")
    }
}
