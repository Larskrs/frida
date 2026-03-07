package com.example.data

import com.example.config.ConfigManager
import com.example.websocket.json
import data.CellValue
import data.Column
import data.Row
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

@Serializable
data class RcColumn(
    @SerialName("ColumnID") val columnId: Int,
    @SerialName("Name")     val name: String,
)

fun String.normalise() = this.lowercase().replace("\\s+".toRegex(), "")

fun fetchRcColumns(config: com.example.config.AppConfig): List<RcColumn> {
    val url = config.rundownUrl +
            "?APIKey=${config.rundownKey}" +
            "&APIToken=${config.rundownToken}" +
            "&Action=getColumns"

    val req = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .GET()
        .timeout(Duration.ofSeconds(10))
        .build()

    val resp = HttpClient.newHttpClient().send(req, HttpResponse.BodyHandlers.ofString())

    if (resp.statusCode() !in 200..299)
        error("getColumns failed: ${resp.statusCode()}")

    return json.decodeFromString(resp.body())
}

fun loadRundownAsSchedule(rundownId: Int): Pair<List<Row>, List<Column>> {
    val config = ConfigManager.loadOrCreate()

    // 1. Fetch canonical columns from the API
    val rcColumns = fetchRcColumns(config)
    println("[RC] Fetched ${rcColumns.size} columns: ${rcColumns.map { "${it.columnId}=${it.name}" }}")

    // 2. Fetch rows
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

    val resp = HttpClient.newHttpClient().send(req, HttpResponse.BodyHandlers.ofString())

    if (resp.statusCode() !in 200..299)
        error("Rundown API failed: ${resp.statusCode()}")

    val arr = json.parseToJsonElement(resp.body()) as? JsonArray
        ?: error("Rundown API returned non-array")

    if (arr.isEmpty()) return Pair(emptyList(), emptyList())

    // 3. Build a normalised-name → actual row JSON key lookup from the first row
    val firstRowKeys = arr.first().jsonObject.keys.toList()
    println("[RC] First row keys: $firstRowKeys")
    val normalisedRowKeyMap = firstRowKeys.associateBy { it.normalise() }

    // 4. Match each RC column to its actual row JSON key
    val matchedColumns = rcColumns
        .sortedBy { it.columnId }
        .mapNotNull { rc ->
            val rowKey = normalisedRowKeyMap[rc.name.normalise()]
            if (rowKey == null) {
                println("[RC] Column '${rc.name}' (${rc.columnId}) -> no matching row key, skipping")
                null
            } else {
                println("[RC] Column '${rc.name}' (${rc.columnId}) -> matched row key '$rowKey'")
                rc to rowKey
            }
        }
        .filter { (_, rowKey) ->
            // Keep only columns that have at least one non-blank value in this rundown
            arr.any { !it.jsonObject[rowKey]?.jsonPrimitive?.contentOrNull.isNullOrBlank() }
        }

    val columns = matchedColumns.mapIndexed { index, (rc, _) ->
        Column(id = rc.columnId, name = rc.name, type = "Text", order = index)
    }

    println("[RC] Final columns: ${columns.map { "${it.id}=${it.name}" }}")

    // 5. columnId → rowKey map for cell building
    val columnRowKeys: Map<Int, String> = matchedColumns.associate { (rc, rowKey) -> rc.columnId to rowKey }

    // 6. Build rows — cells keyed by real ColumnID
    val rows = arr.mapIndexed { rowIndex, el ->
        val obj = el.jsonObject

        val id       = obj["RowID"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: rowIndex
        val page     = obj["PageNumber"]?.jsonPrimitive?.contentOrNull ?: "A$rowIndex"
        val title    = obj["StorySlug"]?.jsonPrimitive?.contentOrNull ?: ""
        val duration = (obj["EstimatedDuration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L) * 1000L

        val cells = columnRowKeys.entries.fold(LinkedHashMap<Int, CellValue>()) { map, (colId, rowKey) ->
            val value = obj[rowKey]?.jsonPrimitive?.contentOrNull ?: ""
            map[colId] = CellValue.Text(value)
            map
        }

        Row(
            id       = id,
            page     = page,
            title    = title,
            duration = duration,
            cells    = cells,
            order    = rowIndex,
        )
    }

    return Pair(rows, columns)
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