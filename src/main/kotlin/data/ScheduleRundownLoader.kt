package com.example.data

import com.example.config.AppConfig
import com.example.config.ConfigManager
import com.example.escape
import com.example.websocket.json
import kotlinx.serialization.json.*
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

fun dumpRundownRawCsv(config: AppConfig) {
    try {
        val url = "${config.rundownUrl}" +
                "?APIKey=${(config.rundownKey)}" +
                "&APIToken=${(config.rundownToken)}" +
                "&Action=getRows" +
                "&RundownID=${config.rundownId}"

        val req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .GET()
            .build()

        val http = HttpClient.newHttpClient()

        val resp = http.send(req, HttpResponse.BodyHandlers.ofString())

        if (resp.statusCode() !in 200..299) {
            println("API failed: ${resp.statusCode()}")
            return
        }

        val arr = json.parseToJsonElement(resp.body()) as? JsonArray
            ?: return println("Not an array")

        if (arr.isEmpty()) {
            println("No rows returned")
            return
        }

        // ---- HEADERS FROM FIRST OBJECT ----
        val excludedHeaders = arrayOf("RowID", "Approved", "PageNumber", "Floated", "Locked", "Following", "ActualDuration", "Deleted", "sebbecues", "ScriptHasContent", "Position", "RundownID")

        var headers = arr.first().jsonObject.keys.toList()
        headers = headers.filter {
            !excludedHeaders.contains(it)
        }
        println(headers)
        val csv = StringBuilder()

        // Header line
        csv.append(headers.joinToString(",") { escape(it) }).append("\n")

        // Rows
        for (el in arr) {
            val obj = el.jsonObject
            val line = headers.map { key ->
                val value = obj[key]?.jsonPrimitive?.contentOrNull ?: ""
                escape(value)
            }
            csv.append(line.joinToString(",")).append("\n")
        }

        val dir = File(ConfigManager.workDir, "schedules").apply { mkdirs() }
        val file = File(dir, config.schedule)

        val normalizedCsv = csv.toString().replace("\r\n", "\n")
        file.writeText(normalizedCsv, Charsets.UTF_8)

        println("CSV written: ${file.absolutePath}")
        println("Columns: ${headers.size}")
        println("Rows: ${arr.size}")

    } catch (e: Exception) {
        e.printStackTrace()
    }
}

fun loadColumnsFromRundown(rundownId: Int): List<Column> {
    val config = ConfigManager.loadOrCreate()

    val url = config.rundownUrl +
            "?APIKey=${config.rundownKey}" +
            "&APIToken=${config.rundownToken}" +
            "&Action=getRows" +
            "&RundownID=$rundownId"

    val req = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .GET()
        .timeout(Duration.ofSeconds(10))
        .build()

    val http = HttpClient.newHttpClient()
    val resp = http.send(req, HttpResponse.BodyHandlers.ofString())

    if (resp.statusCode() !in 200..299) {
        error("Rundown API failed: ${resp.statusCode()}")
    }

    val arr = json.parseToJsonElement(resp.body()) as? JsonArray
        ?: error("Rundown API returned non-array")

    if (arr.isEmpty()) return emptyList()

    val excluded = setOf(
        "RowID",
        "Approved",
        "Floated",
        "Locked",
        "Following",
        "Deleted",
        "RundownID",
        "StorySlug",
        "ActualDuration",
        "EstimatedDuration",
        "ScriptHasContent",
        "Break",
        "PageNumber",
        "Position",
    )

    // -----------------------------
    // 1. BUILD STABLE ORDERED KEYS
    // -----------------------------
    val orderedKeys = LinkedHashSet<String>()

    // collect all keys in natural first-seen order
    arr.forEach { el ->
        el.jsonObject.keys.forEach { key ->
            if (key !in excluded) {
                orderedKeys += key
            }
        }
    }

    // -----------------------------
    // 2. REMOVE KEYS EMPTY IN ALL ROWS
    // -----------------------------
    val filteredKeys = orderedKeys.filter { key ->
        arr.any { el ->
            val v = el.jsonObject[key]?.jsonPrimitive?.contentOrNull
            !v.isNullOrBlank()
        }
    }

    println("Cell order: $filteredKeys")

    // -----------------------------
    // 3. BUILD COLUMNS USING ORDER
    // -----------------------------
    return arr.mapIndexed { index, el ->
        val obj = el.jsonObject

        val id = obj["PageNumber"]?.jsonPrimitive?.contentOrNull ?: "R$index"
        val title = obj["StorySlug"]?.jsonPrimitive?.contentOrNull ?: ""

        val durationSec =
            obj["EstimatedDuration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()
                ?: 0L

        val cells = LinkedHashMap<String, CellValue>()

        for (key in filteredKeys) {
            val value = obj[key]?.jsonPrimitive?.contentOrNull ?: ""
            cells[key] = CellValue.Text(value)
        }

        Column(
            id = id,
            title = title,
            duration = durationSec * 1000L,
            cells = cells
        )
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
