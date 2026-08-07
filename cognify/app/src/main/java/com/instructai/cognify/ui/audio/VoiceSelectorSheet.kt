package com.instructai.cognify.ui.audio

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.instructai.cognify.R
import com.instructai.cognify.ui.theme.CognifyColors

internal fun voiceImageFor(name: String): Int? = when (name.lowercase()) {
    "miku nakano" -> R.drawable.miku_nakano
    "miku" -> R.drawable.miku_nakano
    "marin" -> R.drawable.marin
    "makima" -> R.drawable.makima
    "reze" -> R.drawable.reze
    "horikita" -> R.drawable.horikita
    "gojo" -> R.drawable.gojo
    "toji" -> R.drawable.toji
    "shinobu" -> R.drawable.shinobu
    else -> null
}

data class VocalAvatar(
    val id: String?,
    val name: String,
    val subtitle: String,
    val painting: Color,
    val imageRes: Int? = null,
)

fun voiceColor(id: String?, name: String): Color {
    val palette = listOf(
        Color(0xFFE91E63), Color(0xFF9C27B0), Color(0xFF3F51B5),
        Color(0xFF03A9F4), Color(0xFF009688), Color(0xFFFF5722),
        Color(0xFF795548), Color(0xFF607D8B), Color(0xFFFF9800),
        Color(0xFF8BC34A), Color(0xFFE040FB), Color(0xFF00BCD4),
        Color(0xFFFFC107), Color(0xFFCDDC39),
    )
    val hash = (id?.hashCode() ?: 0) xor name.hashCode()
    return palette[kotlin.math.abs(hash) % palette.size]
}

@Composable
fun VoiceSelectorDialog(
    localVoices: List<VocalAvatar>,
    characterVoices: List<VocalAvatar>,
    selectedId: String?,
    onSelect: (String?, String) -> Unit,
    onDismiss: () -> Unit,
) {
    val selectedAvatar = (localVoices + characterVoices).firstOrNull { it.id == selectedId }
        ?: localVoices.firstOrNull { it.id == null }
    var previewPlaying by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(CognifyColors.DeepNavy, CognifyColors.DeepNavyLight)
                    )
                ),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                // --- Header ---
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Select Voice",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Filled.Close, contentDescription = "Close", tint = Color.White)
                        }
                    }
                }

                // --- Selected Voice Preview ---
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(88.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.radialGradient(
                                        colors = listOf(Color.White, selectedAvatar?.painting ?: CognifyColors.ElectricViolet)
                                    )
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selectedAvatar?.imageRes != null) {
                                Image(
                                    painter = painterResource(selectedAvatar.imageRes),
                                    contentDescription = selectedAvatar.name,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop,
                                )
                            } else {
                                Icon(
                                    Icons.Filled.Person,
                                    contentDescription = null,
                                    modifier = Modifier.size(40.dp),
                                    tint = Color.White,
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = selectedAvatar?.name ?: "System Voice",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White,
                        )
                        Text(
                            text = selectedAvatar?.subtitle ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.6f),
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Clip preview
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(CognifyColors.Charcoal)
                                .clickable { previewPlaying = true }
                                .padding(vertical = 12.dp, horizontal = 20.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(CognifyColors.ElectricViolet),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Filled.VolumeUp,
                                    contentDescription = "Volume",
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp),
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Voice Sample", color = Color.White, style = MaterialTheme.typography.labelMedium)
                                Text(
                                    "Tap to preview",
                                    color = Color.White.copy(alpha = 0.5f),
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            if (!previewPlaying) {
                                Icon(Icons.Filled.PlayArrow, contentDescription = "Play", tint = CognifyColors.ElectricViolet)
                            } else {
                                Text(
                                    "...",
                                    color = CognifyColors.ElectricVioletLight,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }

                item { Spacer(modifier = Modifier.height(28.dp)) }

                // --- Local Voices Section ---
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Local Voices",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "${localVoices.size}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.5f),
                        )
                    }
                }

                item { Spacer(modifier = Modifier.height(12.dp)) }

                // Local voices: compact squares, 3 per row
                item {
                    if (localVoices.isNotEmpty()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            localVoices.forEach { voice ->
                                VoiceSquareCard(
                                    avatar = voice,
                                    selected = voice.id == selectedId,
                                    onClick = { onSelect(voice.id, voice.name) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .weight(1f)
                                        .aspectRatio(1f),
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(24.dp))
                    }
                }

                item { Spacer(modifier = Modifier.height(16.dp)) }

                // --- Character Voices Section ---
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Character Voices",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "${characterVoices.size}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.5f),
                        )
                    }
                }

                item { Spacer(modifier = Modifier.height(12.dp)) }

                // Character voices: 2 per row
                item {
                    if (characterVoices.isNotEmpty()) {
                        characterVoices.chunked(2).forEach { chunk ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                            ) {
                                chunk.forEach { voice ->
                                    VoiceCharacterCard(
                                        avatar = voice,
                                        selected = voice.id == selectedId,
                                        onClick = { onSelect(voice.id, voice.name) },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .weight(1f),
                                    )
                                }
                                // Fill empty slot if odd count
                                if (chunk.size == 1) {
                                    Spacer(modifier = Modifier.fillMaxWidth().weight(1f))
                                }
                            }
                            Spacer(modifier = Modifier.height(14.dp))
                        }
                    } else {
                        Text(
                            "Loading character voices...",
                            modifier = Modifier.padding(horizontal = 20.dp),
                            color = Color.White.copy(alpha = 0.4f),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }

                item { Spacer(modifier = Modifier.height(48.dp)) }
            }
        }
    }
}

// --- Local voice: compact square card with label ---

@Composable
private fun VoiceSquareCard(
    avatar: VocalAvatar,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val borderMod = if (selected) {
        Modifier.border(2.dp, CognifyColors.ElectricVioletLight, RoundedCornerShape(16.dp))
    } else {
        Modifier.border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.verticalGradient(
                    listOf(avatar.painting.copy(alpha = 0.5f), avatar.painting.copy(alpha = 0.15f))
                )
            )
            .then(borderMod)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(avatar.painting),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = avatar.name.take(1).uppercase(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = avatar.name,
                color = Color.White,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (selected) {
                Spacer(modifier = Modifier.height(3.dp))
                Icon(
                    Icons.Filled.Check,
                    contentDescription = "Selected",
                    tint = CognifyColors.ElectricVioletLight,
                    modifier = Modifier.size(14.dp),
                )
            }
        }
    }
}

// --- Character voice: big card with portrait image, name, likes ---

@Composable
private fun VoiceCharacterCard(
    avatar: VocalAvatar,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val borderMod = if (selected) {
        Modifier.border(2.dp, CognifyColors.Gold, RoundedCornerShape(20.dp))
    } else {
        Modifier.border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(20.dp))
    }

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .then(borderMod)
            .background(
                Brush.verticalGradient(
                    listOf(avatar.painting.copy(alpha = 0.35f), avatar.painting.copy(alpha = 0.08f))
                )
            )
            .clickable { onClick() }
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Character portrait (square)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(16.dp))
                .background(avatar.painting.copy(alpha = 0.4f)),
            contentAlignment = Alignment.Center,
        ) {
            if (avatar.imageRes != null) {
                Image(
                    painter = painterResource(avatar.imageRes),
                    contentDescription = avatar.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Text(
                    text = avatar.name.take(1).uppercase(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 34.sp,
                )
            }
            if (selected) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(CognifyColors.Gold),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Check,
                        contentDescription = "Selected",
                        tint = CognifyColors.DeepNavy,
                        modifier = Modifier.size(15.dp),
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = avatar.name,
            color = Color.White,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )

        if (avatar.subtitle.isNotBlank()) {
            Text(
                text = avatar.subtitle,
                color = Color.White.copy(alpha = 0.55f),
                style = MaterialTheme.typography.labelSmall,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
        }
    }
}