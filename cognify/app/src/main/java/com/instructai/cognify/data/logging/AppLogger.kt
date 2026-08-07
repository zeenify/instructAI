package com.instructai.cognify.data.logging

import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

data class LogEntry(
    val timestamp: Long,
    val tag: String,
    val message: String,
    val stackTrace: String? = null,
) {
    fun formatted(): String {
        val date = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(timestamp))
        val base = "[$date] [$tag] $message"
        return if (stackTrace != null) "$base\n$stackTrace" else base
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("t", timestamp)
        put("tag", tag)
        put("msg", message)
        put("st", stackTrace ?: "")
    }

    companion object {
        fun fromJson(obj: JSONObject): LogEntry = LogEntry(
            timestamp = obj.optLong("t", System.currentTimeMillis()),
            tag = obj.optString("tag", "?"),
            message = obj.optString("msg", ""),
            stackTrace = obj.optString("st", "").ifBlank { null },
        )
    }
}

private val LOG_KEY = stringPreferencesKey("app_error_logs")

@Singleton
class AppLogger @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {
    private val maxEntries = 200
    private val buffer = mutableListOf<LogEntry>()

    init {
        buffer.addAll(runBlocking { loadPersisted() })
    }

    fun log(tag: String, message: String, error: Throwable? = null) {
        val entry = LogEntry(
            timestamp = System.currentTimeMillis(),
            tag = tag,
            message = message,
            stackTrace = error?.let { stackTraceString(it) },
        )
        buffer.add(entry)
        if (buffer.size > maxEntries) {
            buffer.removeAt(0)
        }
        Log.e(tag, message, error)

        runBlocking {
            persist()
        }
    }

    fun getLogs(): List<LogEntry> = buffer.toList()

    fun getLogsFlow(): Flow<List<LogEntry>> = dataStore.data.map { prefs ->
        val raw = prefs[LOG_KEY] ?: "[]"
        try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { LogEntry.fromJson(arr.getJSONObject(it)) }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun clear() {
        buffer.clear()
        runBlocking {
            dataStore.edit { prefs -> prefs.remove(LOG_KEY) }
        }
    }

    fun logCount(): Int = buffer.size

    fun logText(): String = buffer.joinToString("\n\n---\n\n") { it.formatted() }

    private suspend fun loadPersisted(): List<LogEntry> {
        return try {
            val prefs = dataStore.data.first()
            val raw = prefs[LOG_KEY] ?: "[]"
            val arr = JSONArray(raw)
            (0 until arr.length()).map { LogEntry.fromJson(arr.getJSONObject(it)) }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private suspend fun persist() {
        try {
            val arr = JSONArray()
            buffer.forEach { arr.put(it.toJson()) }
            dataStore.edit { prefs -> prefs[LOG_KEY] = arr.toString() }
        } catch (_: Exception) { }
    }

    private fun stackTraceString(error: Throwable): String {
        val sw = java.io.StringWriter()
        val pw = java.io.PrintWriter(sw)
        error.printStackTrace(pw)
        val trace = sw.toString()
        return trace.lines().take(10).joinToString("\n")
    }
}
