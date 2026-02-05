package com.example.data

import com.example.nextFullSecond
import java.io.BufferedReader
import java.io.InputStreamReader
import kotlin.system.measureTimeMillis

object ScheduleCsvLoader {

    private val timeRegex = Regex("""^\d{2}:\d{2}:\d{2}$""")

    fun loadFromResources(fileName: String = "schedule.csv"): Schedule {
        println("[CSV] ===== LOADING SCHEDULE =====")
        val totalTime = measureTimeMillis {

            println("[CSV] File requested: $fileName")

            val stream = this::class.java.classLoader
                .getResourceAsStream(fileName)
                ?: error("[CSV] ERROR: CSV not found: $fileName")

            val reader = BufferedReader(InputStreamReader(stream))

            val lines = reader.readLines().filter { it.isNotBlank() }

            println("[CSV] Total lines read: ${lines.size}")

            if (lines.size < 2) error("[CSV] ERROR: CSV empty or missing rows")

            // Normalize headers
            val rawHeaders = lines.first().split(",")
            val headers = rawHeaders.map { it.trim().lowercase() }

            println("[CSV] Headers detected: $headers")

            val rows = lines.drop(1)
            println("[CSV] Row count: ${rows.size}")

            val start = nextFullSecond()
            println("[CSV] Program start snapped to: $start")

            val columns = rows.mapIndexed { index, row ->

                println("[CSV] ---- ROW $index ----")
                println("[CSV] Raw row: $row")

                val rawValues = row.split(",")

                // Pad missing values
                val values = rawValues + List(headers.size - rawValues.size) { "" }

                val map = headers.zip(values).toMap()

                println("[CSV] Parsed map: $map")

                val col = Column(
                    id = map["id"] ?: "R$index",
                    title = map["title"] ?: "Untitled",
                    duration = parseDuration(map["duration"]),
                    cells = buildCells(map),
                    activatedAt = if (index == 0) start else 0
                )

                println("[CSV] Column built: $col")

                col
            }

            val schedule = Schedule(
                columns = columns,
                activeColumnId = columns.firstOrNull()?.id,
                programStart = start
            )

            println("[CSV] Schedule ready with ${columns.size} columns")
            println("[CSV] Active column: ${schedule.activeColumnId}")

            return schedule
        }

        println("[CSV] LOAD COMPLETE in ${totalTime}ms")
        println("[CSV] =========================")
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
