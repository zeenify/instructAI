package com.instructai.cognify.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import com.instructai.cognify.BuildConfig
import com.instructai.cognify.data.prefs.ThemeMode
import com.instructai.cognify.data.repository.ApiMode
import com.instructai.cognify.ui.theme.CognifyColors
import com.instructai.cognify.ui.theme.LocalIsDarkTheme

/*
 * Settings — iOS grouped-list style. Sections: profile, appearance
 * (system/light/dark), study data, AI generation, account.
 * Test-bed leftovers (Voice Lab, on-device AI, manual server URL, debug logs)
 * were removed entirely.
 */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val isLoggedOut by viewModel.isLoggedOut.collectAsState()
    val aiSettings by viewModel.aiSettings.collectAsState()
    val themeMode by viewModel.themeMode.collectAsState()
    val isClearingData by viewModel.isClearingData.collectAsState()
    val isDark = LocalIsDarkTheme.current

    var showLogoutDialog by remember { mutableStateOf(false) }
    var showClearDialog by remember { mutableStateOf(false) }
    var showClearDone by remember { mutableStateOf(false) }

    LaunchedEffect(isLoggedOut) {
        if (isLoggedOut) onLogout()
    }

    if (showLogoutDialog) {
        SettingsDialog(
            icon = Icons.AutoMirrored.Filled.Logout,
            iconTint = MaterialTheme.colorScheme.error,
            iconBg = MaterialTheme.colorScheme.errorContainer,
            title = "Log Out",
            message = "Any study data that hasn't synced yet stays on this device. You can log back in anytime.",
            confirmText = "Log Out",
            destructive = true,
            onDismiss = { showLogoutDialog = false },
            onConfirm = {
                showLogoutDialog = false
                viewModel.logout()
            },
        )
    }

    if (showClearDialog) {
        SettingsDialog(
            icon = Icons.Filled.DeleteForever,
            iconTint = MaterialTheme.colorScheme.error,
            iconBg = MaterialTheme.colorScheme.errorContainer,
            title = "Clear All Data?",
            message = "Every reviewer, flashcard, and study record saved on this phone will be permanently removed.",
            confirmText = if (isClearingData) null else "Delete Everything",
            destructive = true,
            onDismiss = { if (!isClearingData) showClearDialog = false },
            onConfirm = {
                viewModel.clearAllData()
                showClearDialog = false
                showClearDone = true
            },
        )
    }

    if (showClearDone) {
        SettingsDialog(
            icon = Icons.Filled.CheckCircle,
            iconTint = CognifySettings.green(),
            iconBg = CognifySettings.greenSoft(),
            title = "All Cleared",
            message = "Your local study data has been erased. Fresh copies of your class reviewers will download next time you open them.",
            confirmText = "Done",
            onDismiss = { showClearDone = false },
            onConfirm = { showClearDone = false },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState()),
    ) {
        // Slim header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 6.dp, end = 20.dp, top = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "Settings",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }

        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
        ) {
            val user = viewModel.user

            Spacer(modifier = Modifier.height(10.dp))

            if (user != null) {
                GroupedCard {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.13f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = user.name.take(1).uppercase(),
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = user.name,
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Spacer(modifier = Modifier.height(1.dp))
                            Text(
                                text = user.email,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(26.dp))

            SectionLabel("Appearance")
            GroupedCard {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.Palette,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "Theme",
                            style = MaterialTheme.typography.titleSmall,
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    ThemeSegmentedControl(
                        selected = themeMode,
                        onSelect = viewModel::setThemeMode,
                    )
                }
            }

            Spacer(modifier = Modifier.height(26.dp))

            SectionLabel("Study Data")
            GroupedCard {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { if (!isClearingData) showClearDialog = true }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.DeleteForever,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Clear All Data",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Spacer(modifier = Modifier.height(1.dp))
                        Text(
                            text = "Remove reviewers, cards, and study history from this device",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (isClearingData) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    } else {
                        Chevron()
                    }
                }
            }

            Spacer(modifier = Modifier.height(26.dp))

            SectionLabel("AI Generation")
            GroupedCard {
                Column {
                    ToggleRow(
                        icon = Icons.Filled.Shield,
                        title = "School Server",
                        subtitle = "Default — no setup needed, fair-use limits apply",
                        selected = aiSettings.apiMode == ApiMode.BACKEND,
                        onClick = { viewModel.setApiMode(ApiMode.BACKEND) },
                        showDivider = aiSettings.apiMode == ApiMode.GEMINI,
                    )
                    if (aiSettings.apiMode == ApiMode.GEMINI) {
                        var editKey by remember(aiSettings.directApiKey) { mutableStateOf(aiSettings.directApiKey) }
                        Column(modifier = Modifier.padding(start = 52.dp, end = 16.dp, bottom = 14.dp)) {
                            OutlinedTextField(
                                value = editKey,
                                onValueChange = { editKey = it },
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("Gemini API Key") },
                                placeholder = { Text("AIza...") },
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp),
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    viewModel.setDirectApiKey(editKey)
                                    viewModel.saveDirectApiKey()
                                },
                                modifier = Modifier.fillMaxWidth().height(42.dp),
                                shape = RoundedCornerShape(12.dp),
                                enabled = editKey.isNotBlank(),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.primary,
                                    contentColor = MaterialTheme.colorScheme.onPrimary,
                                ),
                            ) {
                                Text("Save Key", style = MaterialTheme.typography.labelLarge)
                            }
                        }
                    }
                    ToggleRow(
                        icon = Icons.Filled.Key,
                        title = "Use My Own Key (Gemini)",
                        subtitle = "Bring a personal API key for higher limits",
                        selected = aiSettings.apiMode == ApiMode.GEMINI,
                        onClick = { viewModel.setApiMode(ApiMode.GEMINI) },
                        showDivider = false,
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            GroupedCard {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Cloud,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Connected Server",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Spacer(modifier = Modifier.height(1.dp))
                        Text(
                            text = aiSettings.serverHost.ifBlank { BuildConfig.API_BASE_URL },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(26.dp))

            SectionLabel("About")
            GroupedCard {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Info,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(modifier = Modifier.width(14.dp))
                    Text(
                        text = "Version",
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = BuildConfig.VERSION_NAME,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(26.dp))

            SectionLabel("Account")
            GroupedCard {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showLogoutDialog = true }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Log Out",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Spacer(modifier = Modifier.height(1.dp))
                        Text(
                            text = "Sign out of your Cognify account",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Chevron()
                }
            }

            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

private object CognifySettings {
    @Composable fun green() = if (LocalIsDarkTheme.current) CognifyColors.GreenD else CognifyColors.GreenL
    @Composable fun greenSoft() = green().copy(alpha = 0.16f)
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 16.dp, bottom = 7.dp),
    )
}

@Composable
private fun GroupedCard(content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        content()
    }
}

@Composable
private fun Chevron() {
    Icon(
        Icons.Filled.ChevronRight,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f),
        modifier = Modifier.size(18.dp),
    )
}

/** iOS-style 3-way segmented control (System / Light / Dark). */
@Composable
private fun ThemeSegmentedControl(
    selected: ThemeMode,
    onSelect: (ThemeMode) -> Unit,
) {
    val options = listOf(
        ThemeMode.SYSTEM to "Automatic",
        ThemeMode.LIGHT to "Light",
        ThemeMode.DARK to "Dark",
    )
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(modifier = Modifier.padding(3.dp)) {
            options.forEach { (mode, label) ->
                val isSelected = selected == mode
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            if (isSelected) MaterialTheme.colorScheme.surface
                            else Color.Transparent
                        )
                        .clickable { if (!isSelected) onSelect(mode) }
                        .padding(vertical = 9.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.onSurface
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ToggleRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit,
    showDivider: Boolean,
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(26.dp),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = if (selected) MaterialTheme.colorScheme.primary
                           else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(21.dp),
                )
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                )
                Spacer(modifier = Modifier.height(1.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (selected) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = "Selected",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
        if (showDivider) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(0.75.dp)
                    .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
            )
        }
    }
}

@Composable
private fun SettingsDialog(
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    title: String,
    message: String,
    confirmText: String?,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    destructive: Boolean = false,
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        ) {
            Column(
                modifier = Modifier.padding(26.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(50.dp)
                        .clip(CircleShape)
                        .background(iconBg),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        icon,
                        contentDescription = null,
                        tint = iconTint,
                        modifier = Modifier.size(24.dp),
                    )
                }
                Spacer(modifier = Modifier.height(14.dp))
                Text(text = title, style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(22.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            contentColor = MaterialTheme.colorScheme.onSurface,
                        ),
                    ) {
                        Text("Cancel", style = MaterialTheme.typography.labelLarge)
                    }
                    if (confirmText != null) {
                        Button(
                            onClick = onConfirm,
                            modifier = Modifier.weight(1f).height(46.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (destructive) MaterialTheme.colorScheme.error
                                                 else MaterialTheme.colorScheme.primary,
                                contentColor = if (destructive) MaterialTheme.colorScheme.onError
                                               else MaterialTheme.colorScheme.onPrimary,
                            ),
                        ) {
                            Text(confirmText, style = MaterialTheme.typography.labelLarge)
                        }
                    }
                }
            }
        }
    }
}

