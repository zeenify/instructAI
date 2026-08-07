package com.instructai.cognify.data.remote

import com.instructai.cognify.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ServerResolver @Inject constructor(
    private val tokenManager: TokenManager,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val probeClient = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(2, TimeUnit.SECONDS)
        .callTimeout(3, TimeUnit.SECONDS)
        .build()

    fun resolveInBackground() {
        scope.launch {
            val target = if (isReachable(BuildConfig.API_BASE_URL)) {
                BuildConfig.API_BASE_URL
            } else {
                BuildConfig.PROD_API_BASE_URL
            }
            tokenManager.setResolvedServerUrl(target)
        }
    }

    private suspend fun isReachable(baseUrl: String): Boolean = withContext(Dispatchers.IO) {
        try {
            probeClient.newCall(Request.Builder().url(baseUrl).build()).execute().use { true }
        } catch (e: IOException) {
            false
        } catch (e: Exception) {
            false
        }
    }
}
