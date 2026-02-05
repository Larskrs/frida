package com.example.data

import java.io.BufferedReader
import java.io.InputStreamReader
import java.time.Instant

object ScheduleCsvLoader {

    private val timeRegex = Regex("""^\d{2}:\d{2}:\d{2}$""")


    fun loadFromResources(fileName: String = "schedule.csv"): Schedule {
        val stream = this::class.java.classLoader
            .getResourceAsStream(fileName)
            ?: error("CSV not found: $fileName")

        val reader = BufferedReader(InputStreamReader(stream))

        val lines = reader.readLines().filter { it.isNotBlank() }
        if (lines.size < 2) error("CSV empty")

        val headers = lines.first().split(",").map { it.trim() }
        val rows = lines.drop(1)

        val columns = rows.mapIndexed { index, row ->
            val values = row.split(",")
            val map = headers.zip(values).toMap()

            Column(
                id = map["ID"] ?: "R$index",
                title = map["Title"] ?: "Untitled",
                duration = parseDuration(map["Duration"]),
                cells = buildCells(map)
            )
        }

        return Schedule(
            columns = columns,
            activeColumnId = columns.firstOrNull()?.id,
            programStart = Instant.now().toEpochMilli()
        )
    }

    private fun buildCells(map: Map<String, String>): Map<String, CellValue> {
        val ignored = setOf("ID", "Title", "Duration")

        return map
            .filterKeys { it !in ignored }
            .mapValues { (_, v) -> detectType(v) }
    }

    private fun detectType(value: String): CellValue {
        val trimmed = value.trim()

        return when {
            trimmed.isBlank() ->
                CellValue.Text("")

            // TRUE / FALSE
            trimmed.equals("true", true) ||
                    trimmed.equals("false", true) ->
                CellValue.Bool(trimmed.toBoolean())

            // HH:MM:SS TIME
            timeRegex.matches(trimmed) ->
                CellValue.Time(parseTimeToMillis(trimmed))

            // NUMBER
            trimmed.toDoubleOrNull() != null ->
                CellValue.Number(trimmed.toDouble())

            // LIST
            trimmed.contains(";") ->
                CellValue.StringList(trimmed.split(";").map { it.trim() })

            // DEFAULT
            else ->
                CellValue.Text(trimmed)
        }
    }


    private fun parseDuration(text: String?): Long {
        if (text == null) return 0

        // supports "00:01:30"
        val parts = text.split(":").mapNotNull { it.toLongOrNull() }
        if (parts.size != 3) return 0

        val (h, m, s) = parts
        return (h * 3600 + m * 60 + s) * 1000
    }
}




private fun parseTimeToMillis(text: String): Long {
    val parts = text.split(":").map { it.toLong() }
    val (h, m, s) = parts
    return (h * 3600 + m * 60 + s) * 1000
}
