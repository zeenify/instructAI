package com.instructai.cognify.data.local.ai

import android.content.Context
import com.instructai.cognify.data.logging.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

data class DownloadProgress(
    val modelId: String,
    val bytesDownloaded: Long,
    val totalBytes: Long,
    val bytesPerSecond: Long = 0,
) {
    val percent: Int
        get() = if (totalBytes > 0) ((bytesDownloaded * 100) / totalBytes).toInt() else 0
}

sealed class DownloadEvent {
    data class Progress(val progress: DownloadProgress) : DownloadEvent()
    data class Done(val file: File) : DownloadEvent()
    data class Failed(val message: String) : DownloadEvent()
}

/**
 * Streams model .task files into filesDir/models/ with resume support —
 * critical for 3GB downloads on mobile data. A partially downloaded file is
 * kept and resumed via HTTP Range on the next [download] call.
 */
@Singleton
class ModelDownloadManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val logger: AppLogger,
) {
    val modelsDir: File
        get() = File(context.filesDir, "models").apply { mkdirs() }
    fun modelFile(spec: ModelSpec): File = File(modelsDir, spec.fileName)

    fun partialFile(spec: ModelSpec): File = File(modelsDir, spec.fileName + ".part")

    fun isDownloaded(spec: ModelSpec): Boolean =
        modelFile(spec).exists() && modelFile(spec).length() >= spec.sizeBytes

    /** Total bytes currently used by model files (complete or in-progress). */
    fun usedBytes(): Long =
        modelsDir.listFiles()?.sumOf { it.length() } ?: 0L

    fun deleteModel(spec: ModelSpec): Boolean {
        val full = modelFile(spec)
        val part = partialFile(spec)
        val existed = full.exists() || part.exists()
        full.delete()
        part.delete()
        logger.log("ModelDownloadManager", "Deleted model ${spec.id} (existed=$existed)")
        return existed
    }

    fun download(spec: ModelSpec): Flow<DownloadEvent> = callbackFlow {
        val downloadClient = OkHttpClient.Builder().build()
        var call: okhttp3.Call? = null

        try {
            val target = partialFile(spec)
            val resumeFrom = if (target.exists()) target.length() else 0L

            val request = Request.Builder()
                .url(spec.downloadUrl)
                .apply { if (resumeFrom > 0) header("Range", "bytes=$resumeFrom-") }
                .build()

            call = downloadClient.newCall(request)
            val response = call.execute()

            if (!response.isSuccessful) {
                trySend(DownloadEvent.Failed("HTTP ${response.code}"))
                close()
                return@callbackFlow
            }

            val body = response.body ?: run {
                trySend(DownloadEvent.Failed("Empty response body"))
                close()
                return@callbackFlow
            }

            // On 206 Partial Content the stream continues from resumeFrom;
            // otherwise the server ignored Range and we restart from zero.
            val resuming = response.code == 206 && resumeFrom > 0
            if (!resuming && target.exists()) target.delete()

            val total = body.contentLength().let { contentLength ->
                if (contentLength > 0) contentLength + (if (resuming) resumeFrom else 0L)
                else spec.sizeBytes
            }

            var lastEmitBytes = if (resuming) resumeFrom else 0L
            var lastEmitTime = System.currentTimeMillis()
            var downloaded = lastEmitBytes

            val out = if (resuming) target.appendOutputStream() else target.outputStream()
            out.use { stream ->
                body.byteStream().use { input ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        stream.write(buffer, 0, read)
                        downloaded += read

                        val now = System.currentTimeMillis()
                        if (now - lastEmitTime >= 250) {
                            val speed = ((downloaded - lastEmitBytes) * 1000) /
                                (now - lastEmitTime).coerceAtLeast(1)
                            trySend(
                                DownloadEvent.Progress(
                                    DownloadProgress(spec.id, downloaded, total, speed)
                                )
                            )
                            lastEmitBytes = downloaded
                            lastEmitTime = now
                        }
                    }
                }
            }

            if (downloaded < spec.sizeBytes) {
                // Incomplete — keep the .part file so the next attempt resumes.
                trySend(
                    DownloadEvent.Failed(
                        "Incomplete: ${downloaded / 1_000_000}MB of ${spec.sizeBytes / 1_000_000}MB"
                    )
                )
                close()
                return@callbackFlow
            }

            // Verified size — atomically move into place.
            val finalFile = modelFile(spec)
            if (!target.renameTo(finalFile)) {
                target.copyTo(finalFile, overwrite = true)
                target.delete()
            }
            logger.log("ModelDownloadManager", "Downloaded model ${spec.id} (${downloaded} bytes)")
            trySend(DownloadEvent.Done(finalFile))
            close()
        } catch (e: Exception) {
            // .part file is kept — a retry will resume from where it stopped.
            logger.log("ModelDownloadManager", "Download ${spec.id} failed: ${e.message}")
            trySend(DownloadEvent.Failed(e.message ?: "Download failed"))
            close()
        } finally {
            call?.cancel()
        }

        awaitClose { call?.cancel() }
    }.flowOn(Dispatchers.IO)

    /** Opens the file for append, creating it if missing — used for Range resume. */
    private fun File.appendOutputStream() =
        java.io.FileOutputStream(this, true).buffered()
}
