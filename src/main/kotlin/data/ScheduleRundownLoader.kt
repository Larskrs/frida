package com.example.data

import com.example.config.ConfigManager
import com.example.websocket.json
import kotlinx.serialization.json.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

fun loadColumnsFromRundown(rundownId: Int): List<Row> {
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

        val id: Int = (obj["RowId"]?.jsonPrimitive?.contentOrNull)?.toIntOrNull() ?: index
        val page = obj["PageNumber"]?.jsonPrimitive?.contentOrNull ?: "A$index"

        val title = obj["StorySlug"]?.jsonPrimitive?.contentOrNull ?: ""

        val durationSec =
            obj["EstimatedDuration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()
                ?: 0L

        val cells = LinkedHashMap<String, CellValue>()

        for (key in filteredKeys) {
            val value = obj[key]?.jsonPrimitive?.contentOrNull ?: ""
            cells[key] = CellValue.Text(value)
        }

        Row(
            id = id,
            page = page,
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
