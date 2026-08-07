package com.instructai.cognify.data.tts

import java.io.File

object WavUtil {

    data class PcmAudio(
        val samples: FloatArray,
        val sampleRate: Int,
    )

    fun decode16BitPcm(file: File): PcmAudio? {
        try {
            val bytes = file.readBytes()
            if (bytes.size < 44) return null
            if (bytes[0] != 'R'.code.toByte() || bytes[1] != 'I'.code.toByte() ||
                bytes[2] != 'F'.code.toByte() || bytes[3] != 'F'.code.toByte()
            ) return null
            if (bytes[8] != 'W'.code.toByte() || bytes[9] != 'A'.code.toByte() ||
                bytes[10] != 'V'.code.toByte() || bytes[11] != 'E'.code.toByte()
            ) return null

            var offset = 12
            var audioFormat = -1
            var numChannels = 1
            var sampleRate = 16000
            var bitsPerSample = 16
            var dataOffset = -1
            var dataSize = 0

            while (offset + 8 <= bytes.size) {
                val chunkId = String(bytes, offset, 4, Charsets.US_ASCII)
                val chunkSize = leInt(bytes, offset + 4)
                when (chunkId) {
                    "fmt " -> {
                        audioFormat = leShort(bytes, offset + 8)
                        numChannels = leShort(bytes, offset + 10)
                        sampleRate = leInt(bytes, offset + 12)
                        bitsPerSample = leShort(bytes, offset + 22)
                    }
                    "data" -> {
                        dataOffset = offset + 8
                        dataSize = chunkSize
                    }
                }
                offset += 8 + chunkSize + (chunkSize % 2)
            }

            if (dataOffset < 0 || audioFormat != 1 || bitsPerSample != 16) return null

            val sampleBytes = minOf(dataSize, bytes.size - dataOffset)
            val sampleCount = sampleBytes / 2
            val mono = FloatArray(sampleCount / numChannels)
            for (i in 0 until mono.size) {
                var sum = 0L
                for (ch in 0 until numChannels) {
                    val idx = dataOffset + (i * numChannels + ch) * 2
                    if (idx + 1 >= bytes.size) break
                    val lo = bytes[idx].toInt() and 0xFF
                    val hi = bytes[idx + 1].toInt()
                    sum += ((hi shl 8) or lo).toShort().toInt()
                }
                mono[i] = (sum / numChannels) / 32768f
            }
            return PcmAudio(mono, sampleRate)
        } catch (_: Exception) {
            return null
        }
    }

    private fun leInt(bytes: ByteArray, offset: Int): Int =
        (bytes[offset].toInt() and 0xFF) or
            ((bytes[offset + 1].toInt() and 0xFF) shl 8) or
            ((bytes[offset + 2].toInt() and 0xFF) shl 16) or
            ((bytes[offset + 3].toInt() and 0xFF) shl 24)

    private fun leShort(bytes: ByteArray, offset: Int): Int =
        (bytes[offset].toInt() and 0xFF) or ((bytes[offset + 1].toInt() and 0xFF) shl 8)
}
