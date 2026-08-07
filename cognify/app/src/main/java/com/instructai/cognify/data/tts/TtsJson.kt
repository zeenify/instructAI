package com.instructai.cognify.data.tts

import org.json.JSONArray

object TtsJson {

    fun sectionsToJson(sections: List<Map<String, Any>>): String =
        JSONArray(sections).toString()

    fun paragraphsFromJson(json: String): List<String> {
        val out = mutableListOf<String>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val p = arr.optString(i).trim()
                if (p.isNotEmpty()) out.add(p)
            }
        } catch (_: Exception) {
        }
        return out
    }

    fun sentencesToJson(sentences: List<String>): String =
        JSONArray(sentences).toString()

    fun sentencesFromJson(json: String): List<String> {
        val out = mutableListOf<String>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val s = arr.optString(i).trim()
                if (s.isNotEmpty()) out.add(s)
            }
        } catch (_: Exception) {
        }
        return out
    }

    fun sentencesFromParagraphs(paragraphs: List<String>): List<String> =
        paragraphs.flatMap { splitSentences(it) }

    fun splitSentences(text: String): List<String> {
        return text.trim()
            .split('\n')
            .flatMap { line -> line.split(SENTENCE_BOUNDARY) }
            .map { it.trim() }
            .filter { it.isNotEmpty() }
    }

    private val SENTENCE_BOUNDARY = Regex("(?<=[.!?…][\"'”’]?)\\s+")
}
