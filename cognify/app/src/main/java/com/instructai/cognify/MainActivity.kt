package com.instructai.cognify

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.instructai.cognify.data.prefs.ThemeMode
import com.instructai.cognify.data.prefs.ThemePreferences
import com.instructai.cognify.ui.navigation.CognifyNavGraph
import com.instructai.cognify.ui.theme.CognifyTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.runBlocking
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        const val EXTRA_OPEN_REVIEW = "open_review_id"
    }

    @Inject
    lateinit var themePreferences: ThemePreferences

    private var pendingReviewId by mutableStateOf<Long?>(null)
    private var themeMode by mutableStateOf(ThemeMode.SYSTEM)

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        readIntent(intent)
        // Theme is read up front so the very first frame is already right
        // (avoids a light flash on a dark-mode device).
        themeMode = runCatching {
            runBlocking { themePreferences.current() }
        }.getOrDefault(ThemeMode.SYSTEM)
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        enableEdgeToEdge()
        setContent {
            val observedMode by themePreferences.themeMode.collectAsState(initial = themeMode)
            val darkTheme = when (observedMode) {
                ThemeMode.DARK -> true
                ThemeMode.LIGHT -> false
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
            }
            CognifyTheme(darkTheme = darkTheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    CognifyNavGraph(
                        deepLinkReviewId = pendingReviewId,
                        onDeepLinkHandled = { pendingReviewId = null },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readIntent(intent)
    }

    private fun readIntent(intent: Intent?) {
        val id = intent?.getLongExtra(EXTRA_OPEN_REVIEW, -1L)
        pendingReviewId = if (id != null && id > 0) id else null
    }
}
