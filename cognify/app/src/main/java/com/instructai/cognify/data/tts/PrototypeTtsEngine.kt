package com.instructai.cognify.data.tts

import android.media.MediaPlayer
import com.instructai.cognify.data.logging.AppLogger
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsCallback
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsPocketModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsZipVoiceModelConfig
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

enum class TtsEngineType(val label: String) {
    KOKORO("Kokoro"),
    POCKET("Pocket TTS"),
    ZIPVOICE("ZipVoice"),
}

data class VoiceLabVoice(
    val id: String,
    val label: String,
    val engine: TtsEngineType,
    val sid: Int = 0,
    val referenceFile: String? = null,
    val referenceText: String? = null,
    val numSteps: Int? = null,
)

data class GenResult(
    val voiceLabel: String,
    val engineLabel: String,
    val generationMs: Long,
    val audioDurationMs: Long,
    val loadMs: Long,
    val wavPath: String?,
    val textSnippet: String,
    val error: String? = null,
) {
    val realTimeFactor: Float
        get() = if (audioDurationMs > 0) generationMs.toFloat() / audioDurationMs else 0f
}

@Singleton
class PrototypeTtsEngine @Inject constructor(
    private val logger: AppLogger,
) {
    private var kokoroTts: OfflineTts? = null
    private var pocketTts: OfflineTts? = null
    private var zipvoiceTts: OfflineTts? = null
    private var kokoroLoadMs = 0L
    private var pocketLoadMs = 0L
    private var zipvoiceLoadMs = 0L
    private val referenceCache = mutableMapOf<String, WavUtil.PcmAudio?>()
    private var player: MediaPlayer? = null
    private var playingPath: String? = null
    var isPlaying: Boolean = false
        private set

    private fun modelsDir(context: android.content.Context): File? =
        context.getExternalFilesDir(null)?.let { File(it, "models") }

    private fun kokoroDir(context: android.content.Context): File =
        File(modelsDir(context) ?: File(context.filesDir, "models"), "kokoro-int8-multi-lang-v1_1")

    private fun pocketDir(context: android.content.Context): File =
        File(modelsDir(context) ?: File(context.filesDir, "models"), "sherpa-onnx-pocket-tts-int8-2026-01-26")

    private fun zipvoiceDir(context: android.content.Context): File =
        File(modelsDir(context) ?: File(context.filesDir, "models"), "zipvoice-distill-int8-zh-en-emilia")

    fun modelStatus(context: android.content.Context): List<Pair<String, Long>> {
        val base = modelsDir(context) ?: return emptyList()
        val expected = listOf(
            File(kokoroDir(context), "model.int8.onnx"),
            File(kokoroDir(context), "voices.bin"),
            File(kokoroDir(context), "tokens.txt"),
            File(kokoroDir(context), "lexicon-us-en.txt"),
            File(kokoroDir(context), "lexicon-gb-en.txt"),
            File(kokoroDir(context), "lexicon-zh.txt"),
            File(kokoroDir(context), "espeak-ng-data"),
            File(pocketDir(context), "lm_flow.int8.onnx"),
            File(pocketDir(context), "lm_main.int8.onnx"),
            File(pocketDir(context), "encoder.onnx"),
            File(pocketDir(context), "decoder.int8.onnx"),
            File(pocketDir(context), "text_conditioner.onnx"),
            File(pocketDir(context), "vocab.json"),
            File(pocketDir(context), "token_scores.json"),
            File(zipvoiceDir(context), "encoder.int8.onnx"),
            File(zipvoiceDir(context), "decoder.int8.onnx"),
            File(zipvoiceDir(context), "tokens.txt"),
            File(zipvoiceDir(context), "lexicon.txt"),
            File(zipvoiceDir(context), "espeak-ng-data"),
            File(zipvoiceDir(context), "vocos_24khz.onnx"),
            File(zipvoiceDir(context), "test_wavs/leijun-1.wav"),
            File(base, "zipvoice-test.wav"),
            File(base, "miku.wav"),
            File(base, "nino.wav"),
        )
        return expected.map { it.absolutePath to (if (it.exists()) it.length() else 0L) }
    }

    fun ensureKokoroLoaded(context: android.content.Context): OfflineTts {
        kokoroTts?.let { return it }
        synchronized(this) {
            kokoroTts?.let { return it }
            val dir = kokoroDir(context)
            val start = System.currentTimeMillis()
            val config = OfflineTtsConfig.builder()
                .setModel(
                    OfflineTtsModelConfig.builder()
                        .setNumThreads(2)
                        .setDebug(false)
                        .setKokoro(
                            OfflineTtsKokoroModelConfig.builder()
                                .setModel(File(dir, "model.int8.onnx").absolutePath)
                                .setVoices(File(dir, "voices.bin").absolutePath)
                                .setTokens(File(dir, "tokens.txt").absolutePath)
                                .setLexicon(
                                    listOf("lexicon-us-en.txt", "lexicon-gb-en.txt", "lexicon-zh.txt")
                                        .joinToString(",") { File(dir, it).absolutePath }
                                )
                                .setDataDir(File(dir, "espeak-ng-data").absolutePath)
                                .setLang("en")
                                .build()
                        )
                        .build()
                )
                .build()
            kokoroTts = OfflineTts(config)
            kokoroLoadMs = System.currentTimeMillis() - start
            logger.log("VoiceLab", "Kokoro loaded in ${kokoroLoadMs}ms")
            return kokoroTts!!
        }
    }

    fun ensurePocketLoaded(context: android.content.Context): OfflineTts {
        pocketTts?.let { return it }
        synchronized(this) {
            pocketTts?.let { return it }
            val dir = pocketDir(context)
            val start = System.currentTimeMillis()
            val config = OfflineTtsConfig.builder()
                .setModel(
                    OfflineTtsModelConfig.builder()
                        .setNumThreads(2)
                        .setDebug(false)
                        .setPocket(
                            OfflineTtsPocketModelConfig.builder()
                                .setLmFlow(File(dir, "lm_flow.int8.onnx").absolutePath)
                                .setLmMain(File(dir, "lm_main.int8.onnx").absolutePath)
                                .setEncoder(File(dir, "encoder.onnx").absolutePath)
                                .setDecoder(File(dir, "decoder.int8.onnx").absolutePath)
                                .setTextConditioner(File(dir, "text_conditioner.onnx").absolutePath)
                                .setVocabJson(File(dir, "vocab.json").absolutePath)
                                .setTokenScoresJson(File(dir, "token_scores.json").absolutePath)
                                .build()
                        )
                        .build()
                )
                .build()
            pocketTts = OfflineTts(config)
            pocketLoadMs = System.currentTimeMillis() - start
            logger.log("VoiceLab", "Pocket TTS loaded in ${pocketLoadMs}ms")
            return pocketTts!!
        }
    }

    fun ensureZipVoiceLoaded(context: android.content.Context): OfflineTts {
        zipvoiceTts?.let { return it }
        synchronized(this) {
            zipvoiceTts?.let { return it }
            val dir = zipvoiceDir(context)
            val start = System.currentTimeMillis()
            fun buildConfig(provider: String) = OfflineTtsConfig.builder()
                .setMaxNumSentences(2)
                .setModel(
                    OfflineTtsModelConfig.builder()
                        .setNumThreads(6)
                        .setDebug(false)
                        .setProvider(provider)
                        .setZipvoice(
                            OfflineTtsZipVoiceModelConfig.builder()
                                .setEncoder(File(dir, "encoder.int8.onnx").absolutePath)
                                .setDecoder(File(dir, "decoder.int8.onnx").absolutePath)
                                .setTokens(File(dir, "tokens.txt").absolutePath)
                                .setLexicon(File(dir, "lexicon.txt").absolutePath)
                                .setDataDir(File(dir, "espeak-ng-data").absolutePath)
                                .setVocoder(File(dir, "vocos_24khz.onnx").absolutePath)
                                .build()
                        )
                        .build()
                )
                .build()
            zipvoiceTts = try {
                OfflineTts(buildConfig("xnnpack"))
            } catch (e: Exception) {
                logger.log("VoiceLab", "ZipVoice XNNPACK init failed (${e.message}), falling back to CPU")
                OfflineTts(buildConfig("cpu"))
            }
            zipvoiceLoadMs = System.currentTimeMillis() - start
            logger.log("VoiceLab", "ZipVoice loaded in ${zipvoiceLoadMs}ms")
            return zipvoiceTts!!
        }
    }

    fun generate(context: android.content.Context, voice: VoiceLabVoice, text: String, outDir: File): GenResult {
        val start = System.currentTimeMillis()
        return try {
            val audio = when (voice.engine) {
                TtsEngineType.KOKORO -> {
                    val tts = ensureKokoroLoaded(context)
                    tts.generate(text, voice.sid, 1.0f)
                }
                TtsEngineType.POCKET -> {
                    val tts = ensurePocketLoaded(context)
                    val ref = loadReference(context, voice)
                    if (ref == null) {
                        return GenResult(
                            voiceLabel = voice.label,
                            engineLabel = voice.engine.label,
                            generationMs = System.currentTimeMillis() - start,
                            audioDurationMs = 0,
                            loadMs = pocketLoadMs,
                            wavPath = null,
                            textSnippet = text.take(60),
                            error = "Missing reference clip models/${voice.referenceFile} - push via adb, then reopen Voice Lab",
                        )
                    }
                    val config = GenerationConfig().apply {
                        referenceAudio = ref.samples
                        referenceSampleRate = ref.sampleRate
                        speed = 1.0f
                        numSteps = 24
                    }
                    tts.generateWithConfigAndCallback(text, config, OfflineTtsCallback { 1 })
                }
                TtsEngineType.ZIPVOICE -> {
                    val tts = ensureZipVoiceLoaded(context)
                    val ref = loadReference(context, voice)
                    if (ref == null) {
                        return GenResult(
                            voiceLabel = voice.label,
                            engineLabel = voice.engine.label,
                            generationMs = System.currentTimeMillis() - start,
                            audioDurationMs = 0,
                            loadMs = zipvoiceLoadMs,
                            wavPath = null,
                            textSnippet = text.take(60),
                            error = "Missing reference clip models/${voice.referenceFile} - push via adb, then reopen Voice Lab",
                        )
                    }
                    if (voice.referenceText.isNullOrBlank()) {
                        return GenResult(
                            voiceLabel = voice.label,
                            engineLabel = voice.engine.label,
                            generationMs = System.currentTimeMillis() - start,
                            audioDurationMs = 0,
                            loadMs = zipvoiceLoadMs,
                            wavPath = null,
                            textSnippet = text.take(60),
                            error = "ZipVoice requires referenceText matching the reference clip",
                        )
                    }
                    val config = GenerationConfig().apply {
                        referenceAudio = ref.samples
                        referenceSampleRate = ref.sampleRate
                        speed = 1.0f
                        numSteps = voice.numSteps ?: 4
                        referenceText = voice.referenceText
                        extra = mapOf("min_char_in_sentence" to "10")
                    }
                    tts.generateWithConfigAndCallback(text, config, OfflineTtsCallback { 1 })
                }
            }
            outDir.mkdirs()
            val outFile = File(outDir, "voice_lab_${System.currentTimeMillis()}.wav")
            val saved = audio.save(outFile.absolutePath)
            if (!saved) {
                GenResult(
                    voiceLabel = voice.label, engineLabel = voice.engine.label,
                    generationMs = System.currentTimeMillis() - start, audioDurationMs = 0,
                    loadMs = when (voice.engine) {
                    TtsEngineType.KOKORO -> kokoroLoadMs
                    TtsEngineType.POCKET -> pocketLoadMs
                    TtsEngineType.ZIPVOICE -> zipvoiceLoadMs
                },
                    wavPath = null, textSnippet = text.take(60),
                    error = "Failed to save WAV",
                )
            } else {
                val duration = audioDurationMs(outFile)
                GenResult(
                    voiceLabel = voice.label, engineLabel = voice.engine.label,
                    generationMs = System.currentTimeMillis() - start, audioDurationMs = duration,
                    loadMs = when (voice.engine) {
                    TtsEngineType.KOKORO -> kokoroLoadMs
                    TtsEngineType.POCKET -> pocketLoadMs
                    TtsEngineType.ZIPVOICE -> zipvoiceLoadMs
                },
                    wavPath = outFile.absolutePath, textSnippet = text.take(60),
                )
            }
        } catch (e: Exception) {
            logger.log("VoiceLab", "generate failed: ${e.message}", e)
            GenResult(
                voiceLabel = voice.label, engineLabel = voice.engine.label,
                generationMs = System.currentTimeMillis() - start, audioDurationMs = 0,
                loadMs = 0, wavPath = null, textSnippet = text.take(60),
                error = e.message ?: e.javaClass.simpleName,
            )
        }
    }

    fun play(path: String) {
        stop()
        player = MediaPlayer().apply {
            setDataSource(path)
            setOnCompletionListener { this@PrototypeTtsEngine.isPlaying = false }
            prepare()
            start()
        }
        isPlaying = true
        playingPath = path
    }

    fun stop() {
        player?.let {
            try {
                if (it.isPlaying) it.stop()
            } catch (_: Exception) {
            }
            it.release()
        }
        player = null
        isPlaying = false
        playingPath = null
    }

    fun release() {
        stop()
        kokoroTts?.release()
        kokoroTts = null
        pocketTts?.release()
        pocketTts = null
        zipvoiceTts?.release()
        zipvoiceTts = null
        referenceCache.clear()
    }

    private fun loadReference(context: android.content.Context, voice: VoiceLabVoice): WavUtil.PcmAudio? {
        val file = voice.referenceFile ?: return null
        referenceCache[file]?.let { return it }
        val dir = modelsDir(context) ?: return null
        val f = File(dir, file)
        val decoded = if (f.exists()) WavUtil.decode16BitPcm(f) else null
        referenceCache[file] = decoded
        return decoded
    }

    private fun audioDurationMs(file: File): Long {
        return try {
            val mp = MediaPlayer()
            mp.setDataSource(file.absolutePath)
            mp.prepare()
            val d = mp.duration.toLong()
            mp.release()
            d
        } catch (_: Exception) {
            0L
        }
    }
}
