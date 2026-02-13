package com.example.data

import com.example.nextFullSecond
import java.io.File

object ScheduleCsvLoader {

    private val timeRegex = Regex("""^\d{2}:\d{2}:\d{2}$""")

    fun loadFromFile(file: File): Schedule {
        require(file.exists()) { "CSV not found: ${file.absolutePath}" }

        val lines = file.readLines(Charsets.UTF_8)
            .filter { it.isNotBlank() }

        if (lines.size < 2) error("CSV empty")

        val headers = lines.first()
            .split(",")
            .map { it.trim() }
        val start = nextFullSecond()

        val dropped = lines.drop(1)

        val rows = dropped.mapIndexed { index, r ->
            val values = splitCsvRow(r)

            val map = headers.zip(values).toMap()
            val duration = map["EstimatedDuration"]?.toLongOrNull() ?: 0L

            Row(
                id = map["RowId"]?.toIntOrNull() ?: index,
                page = map["PageNumber"] ?: "A$index",
                title = map["StorySlug"] ?: "",
                duration = duration * 1000L,
                cells = map
                    .filterKeys { it !in setOf("Id", "Title", "Duration") }
                    .mapValues { CellValue.Text(it.value) }
            )
        }

        return Schedule(
            programStart = start,
            title = "Test Schedule",
            rows = rows
        )
    }


    private fun splitCsvRow(row: String): List<String> {
        val result = mutableListOf<String>()
        val sb = StringBuilder()
        var inQuotes = false

        var i = 0
        while (i < row.length) {
            val c = row[i]

            when (c) {
                '"' -> {
                    if (inQuotes && i + 1 < row.length && row[i + 1] == '"') {
                        sb.append('"')
                        i++ // skip escaped quote
                    } else {
                        inQuotes = !inQuotes
                    }
                }

                ',' -> {
                    if (inQuotes) {
                        sb.append(c)
                    } else {
                        result.add(sb.toString())
                        sb.clear()
                    }
                }

                else -> sb.append(c)
            }

            i++
        }

        result.add(sb.toString())
        return result
    }


    private fun buildCells(map: Map<String, String>): Map<String, CellValue> {
        val ignored = setOf("id", "title", "duration")

        val cells = map
            .filterKeys { it !in ignored }
            .mapValues { (k, v) ->
                val detected = detectType(v)
                println("[CSV] Cell [$k] -> $detected")
                detected
            }

        return cells
    }

    private fun detectType(value: String): CellValue {
        val trimmed = value.trim()

        return when {
            trimmed.isBlank() -> CellValue.Text("")

            trimmed.equals("true", true) ||
                    trimmed.equals("false", true) ->
                CellValue.Bool(trimmed.toBoolean())

            timeRegex.matches(trimmed) ->
                CellValue.Time(parseTimeToMillis(trimmed))

            trimmed.toDoubleOrNull() != null ->
                CellValue.Number(trimmed.toDouble())

            trimmed.contains(";") ->
                CellValue.StringList(trimmed.split(";").map { it.trim() })

            else ->
                CellValue.Text(trimmed)
        }
    }

    private fun parseDuration(text: String?): Long {
        if (text.isNullOrBlank()) {
            println("[CSV] Duration empty -> 0")
            return 0
        }

        val parts = text.split(":").mapNotNull { it.toLongOrNull() }

        if (parts.size != 3) {
            println("[CSV] Invalid duration format: $text")
            return 0
        }

        val (h, m, s) = parts
        val ms = (h * 3600 + m * 60 + s) * 1000

        println("[CSV] Duration parsed [$text] -> $ms ms")

        return ms
    }
}

private fun parseTimeToMillis(text: String): Long {
    val parts = text.split(":").mapNotNull { it.toLongOrNull() }

    if (parts.size != 3) {
        println("[CSV] Invalid time format: $text")
        return 0
    }

    val (h, m, s) = parts
    val ms = (h * 3600 + m * 60 + s) * 1000

    println("[CSV] Time parsed [$text] -> $ms ms")

    return ms
}
