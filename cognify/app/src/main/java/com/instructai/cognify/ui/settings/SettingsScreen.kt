package com.instructai.cognify.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.repository.ApiMode
import com.instructai.cognify.ui.theme.CognifyColors
import kotlinx.coroutines.launch
import javax.inject.Inject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit = {},
    isDarkMode: Boolean = true,
    onToggleTheme: () -> Unit = {},
    onClearData: () -> Unit = {},
    onSyncNow: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val isLoggedOut by viewModel.isLoggedOut.collectAsState()

    LaunchedEffect(isLoggedOut) {
        if (isLoggedOut) onLogout()
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
                    Switch(
                        checked = isDarkMode,
                        onCheckedChange = { onToggleTheme() },
                        colors = SwitchDefaults.colors(
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
                icon = Icons.Filled.Sync,
                title = "Sync Now",
                subtitle = "Upload local data to the cloud",
                onClick = onSyncNow,
            )

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
            var editKey by remember(aiSettings.groqApiKey) { mutableStateOf(aiSettings.groqApiKey) }

            // Mode toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("API Mode", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Medium)
                    Text(
                        text = if (aiSettings.apiMode == ApiMode.BACKEND)
                            "Use backend server (recommended)"
                        else "Use your own Groq API key",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(
                    checked = aiSettings.apiMode == ApiMode.BYOK,
                    onCheckedChange = { checked ->
                        viewModel.setApiMode(if (checked) ApiMode.BYOK else ApiMode.BACKEND)
                    },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = CognifyColors.Gold,
                        checkedTrackColor = CognifyColors.ElectricViolet.copy(alpha = 0.4f),
                    ),
                )
            }

            AnimatedVisibility(visible = aiSettings.apiMode == ApiMode.BYOK) {
                Column {
                    OutlinedTextField(
                        value = editKey,
                        onValueChange = { editKey = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Groq API Key") },
                        placeholder = { Text("gsk_...") },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = {
                            viewModel.setGroqApiKey(editKey)
                            viewModel.saveGroqApiKey()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = CognifyColors.ElectricViolet),
                        enabled = editKey.isNotBlank(),
                    ) { Text("Save Key") }
                }
            }

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
                onClick = { viewModel.logout() },
                iconTint = Color(0xFFFF5252),
                titleColor = Color(0xFFFF5252),
            )
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
