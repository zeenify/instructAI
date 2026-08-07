package com.instructai.cognify.ui.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.ui.window.Dialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.CognifyGradients
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit = {},
    onVoiceLab: () -> Unit = {},
    isDarkMode: Boolean = true,
    onToggleTheme: () -> Unit = {},
    onClearData: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val isLoggedOut by viewModel.isLoggedOut.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }

    LaunchedEffect(isLoggedOut) {
        if (isLoggedOut) onLogout()
    }

    if (showLogoutDialog) {
        Dialog(onDismissRequest = { showLogoutDialog = false }) {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            ) {
                Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFFF5252).copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.Logout,
                            contentDescription = null,
                            tint = Color(0xFFFF5252),
                            modifier = Modifier.size(28.dp),
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Log Out",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Are you sure you want to log out?\nAny unsynced data will be lost.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Button(
                            onClick = { showLogoutDialog = false },
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            ),
                        ) {
                            Text("Cancel", fontWeight = FontWeight.SemiBold)
                        }
                        Button(
                            onClick = {
                                showLogoutDialog = false
                                viewModel.logout()
                            },
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                        ) {
                            Text("Log Out", fontWeight = FontWeight.SemiBold, color = Color.White)
                        }
                    }
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            val user = viewModel.user

            if (user != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = CognifyColors.ElectricViolet.copy(alpha = 0.08f)),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(CognifyGradients.primary),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = user.name.take(1).uppercase(),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column {
                            Text(
                                text = user.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text = user.email,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }

            Text(
                text = "Appearance",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = CognifyColors.ElectricViolet,
            )

            Spacer(modifier = Modifier.height(8.dp))

            SettingsCard(
                icon = Icons.Filled.DarkMode,
                title = "Dark Mode",
                subtitle = "Toggle dark theme",
                trailing = {
                    androidx.compose.material3.Switch(
                        checked = isDarkMode,
                        onCheckedChange = { onToggleTheme() },
                        colors = androidx.compose.material3.SwitchDefaults.colors(
                            checkedThumbColor = CognifyColors.Gold,
                            checkedTrackColor = CognifyColors.ElectricViolet.copy(alpha = 0.4f),
                        ),
                    )
                },
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Data & Sync",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = CognifyColors.ElectricViolet,
            )

            Spacer(modifier = Modifier.height(8.dp))

            SettingsCard(
                icon = Icons.Filled.Storage,
                title = "Storage Usage",
                subtitle = "Manage cached files and downloads",
            )

            SettingsCard(
                icon = Icons.Filled.Delete,
                title = "Clear All Data",
                subtitle = "Remove all local reviews and progress",
                onClick = onClearData,
                iconTint = Color(0xFFFF5252),
                titleColor = Color(0xFFFF5252),
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "AI Provider",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = CognifyColors.ElectricViolet,
            )

            Spacer(modifier = Modifier.height(8.dp))

            val aiSettings by viewModel.aiSettings.collectAsState()
            val scope = rememberCoroutineScope()

            ModeRow(
                icon = Icons.Filled.Psychology,
                title = "Use My Own Key (Gemini)",
                subtitle = "Enter your personal Gemini API key",
                selected = aiSettings.apiMode == com.instructai.cognify.data.repository.ApiMode.GEMINI,
                onClick = { viewModel.setApiMode(com.instructai.cognify.data.repository.ApiMode.GEMINI) },
            )

            ModeRow(
                icon = Icons.Filled.Storage,
                title = "Use Server API",
                subtitle = "Default — no key needed, stricter limits",
                selected = aiSettings.apiMode == com.instructai.cognify.data.repository.ApiMode.BACKEND,
                onClick = { viewModel.setApiMode(com.instructai.cognify.data.repository.ApiMode.BACKEND) },
            )

            Spacer(modifier = Modifier.height(12.dp))

            if (aiSettings.apiMode == com.instructai.cognify.data.repository.ApiMode.GEMINI) {
                var editKey by remember(aiSettings.directApiKey) { mutableStateOf(aiSettings.directApiKey) }
                OutlinedTextField(
                    value = editKey,
                    onValueChange = { editKey = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Gemini API Key") },
                    placeholder = { Text("AIza...") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        viewModel.setDirectApiKey(editKey)
                        viewModel.saveDirectApiKey()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                    enabled = editKey.isNotBlank(),
                ) { Text("Save Key") }
            } else {
                Text(
                    text = "Using shared server key. Free-tier limits apply.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Server",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = CognifyColors.ElectricViolet,
            )

            Spacer(modifier = Modifier.height(8.dp))

            val isManual = aiSettings.manualServerUrl != null

            ModeRow(
                icon = Icons.Filled.Sync,
                title = "Automatic (recommended)",
                subtitle = "Laptop when reachable, deployed backend otherwise",
                selected = !isManual,
                onClick = { viewModel.clearServerUrl() },
            )

            ModeRow(
                icon = Icons.Filled.Cloud,
                title = "Manual",
                subtitle = "Pick a specific backend URL",
                selected = isManual,
                onClick = { /* keep current manual URL */ },
            )

            Spacer(modifier = Modifier.height(12.dp))

            if (isManual) {
                var editUrl by remember(aiSettings.serverUrl) { mutableStateOf(aiSettings.serverUrl) }
                OutlinedTextField(
                    value = editUrl,
                    onValueChange = { editUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Backend URL") },
                    placeholder = { Text("https://your-backend.onrender.com/api/") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        viewModel.setServerUrl(editUrl)
                        viewModel.setApiMode(com.instructai.cognify.data.repository.ApiMode.BACKEND)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                    enabled = editUrl.isNotBlank(),
                ) { Text("Save Server") }
            } else {
                Text(
                    text = "Active: ${aiSettings.serverUrl}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Debug",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = CognifyColors.ElectricViolet,
            )

            Spacer(modifier = Modifier.height(8.dp))

            val errorLogs by viewModel.errorLogs.collectAsState()
            val context = LocalContext.current

            SettingsCard(
                icon = Icons.Filled.BugReport,
                title = "Error Logs",
                subtitle = "${errorLogs.size} entries — tap to view",
                onClick = {
                    val text = errorLogs.joinToString("\n\n---\n\n") { it.formatted() }
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("Cognify Error Logs", text))
                },
            )

            if (errorLogs.isNotEmpty()) {
                SettingsCard(
                    icon = Icons.Filled.DeleteSweep,
                    title = "Clear Error Logs",
                    subtitle = "Remove all stored error logs",
                    onClick = { viewModel.clearLogs() },
                    iconTint = Color(0xFFFF5252),
                    titleColor = Color(0xFFFF5252),
                )
            }

            SettingsCard(
                icon = Icons.Filled.RecordVoiceOver,
                title = "Voice Lab (Phase 0)",
                subtitle = "Kokoro vs Pocket TTS voice A/B test",
                onClick = onVoiceLab,
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Account",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = CognifyColors.ElectricViolet,
            )

            Spacer(modifier = Modifier.height(8.dp))

            SettingsCard(
                icon = Icons.Filled.Info,
                title = "About",
                subtitle = "Version 1.0.0",
            )

            SettingsCard(
                icon = Icons.AutoMirrored.Filled.Logout,
                title = "Log Out",
                subtitle = "Sign out of your account",
                onClick = { showLogoutDialog = true },
                iconTint = Color(0xFFFF5252),
                titleColor = Color(0xFFFF5252),
            )
        }
    }
}

@Composable
private fun ModeRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        shape = shape,
        colors = CardDefaults.cardColors(
            containerColor = if (selected)
                CognifyColors.ElectricViolet.copy(alpha = 0.15f)
            else MaterialTheme.colorScheme.surface,
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (selected) CognifyColors.ElectricViolet else CognifyColors.ElectricViolet.copy(alpha = 0.5f),
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                    color = if (selected) CognifyColors.ElectricViolet else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (selected) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = CognifyColors.ElectricViolet,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

@Composable
private fun SettingsCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    trailing: @Composable (() -> Unit)? = null,
    onClick: (() -> Unit)? = null,
    iconTint: Color = CognifyColors.ElectricViolet,
    titleColor: Color = MaterialTheme.colorScheme.onSurface,
) {
    val shape = RoundedCornerShape(16.dp)
    Card(
        onClick = onClick ?: {},
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        shape = shape,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        enabled = onClick != null,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = iconTint,
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                    color = titleColor,
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (trailing != null) {
                trailing()
            } else if (onClick != null) {
                Icon(
                    Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
