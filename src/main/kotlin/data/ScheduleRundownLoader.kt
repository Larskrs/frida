package com.example.data

import com.example.config.ConfigManager
import com.example.websocket.json
import data.CellValue
import data.Column
import data.Row
import data.Schedule
import data.SystemColumns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.upsert
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

private val httpClient = HttpClient.newHttpClient()

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

    val resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString())

    if (resp.statusCode() !in 200..299)
        error("getColumns failed: ${resp.statusCode()}")

    return json.decodeFromString(resp.body())
}

/**
 * Fetches the latest script for a given RC row ID.
 * Returns the plain script text, or null if not found / failed.
 * Uses RemoveCurlyBrackets + RemoveSquareBrackets + RemoveCarets to get clean text.
 */
fun fetchRcScript(config: com.example.config.AppConfig, rowId: Int): String? {
    return try {
        val url = config.rundownUrl +
                "?APIKey=${config.rundownKey}" +
                "&APIToken=${config.rundownToken}" +
                "&Action=getScript" +
                "&RowID=$rowId" +
                "&RemoveCurlyBrackets=true" +
                "&RemoveSquareBrackets=true" +
                "&RemoveCarets=true"

        val req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .GET()
            .timeout(Duration.ofSeconds(10))
            .build()

        val resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString())

        if (resp.statusCode() !in 200..299) {
            println("[RC] getScript failed for row $rowId: ${resp.statusCode()}")
            return null
        }

        val arr = json.parseToJsonElement(resp.body()) as? JsonArray ?: return null
        val first = arr.firstOrNull()?.jsonObject ?: return null
        first["Script"]?.jsonPrimitive?.contentOrNull
    } catch (e: Exception) {
        println("[RC] getScript exception for row $rowId: ${e.message}")
        null
    }
}

fun importRundownAsSchedule(
    rundownId: Int,
    rundownTitle: String,
): Schedule {

    val config = ConfigManager.loadOrCreate()

    // ---- 1. Fetch RC columns ----
    val rcColumns = fetchRcColumns(config)
    println("[RC] Fetched ${rcColumns.size} columns: ${rcColumns.map { "${it.columnId}=${it.name}" }}")

    // ---- 2. Fetch rows ----
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

    val resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString())

    if (resp.statusCode() !in 200..299)
        error("Rundown API failed: ${resp.statusCode()}")

    val arr = json.parseToJsonElement(resp.body()) as? JsonArray
        ?: error("Rundown API returned non-array")

    // ---- 3. Match RC columns to row JSON keys ----
    val firstRowKeys = if (arr.isNotEmpty()) arr.first().jsonObject.keys.toList() else emptyList()
    println("[RC] First row keys: $firstRowKeys")
    val normalisedRowKeyMap = firstRowKeys.associateBy { it.normalise() }

    val matchedColumns = rcColumns
        .sortedBy { it.columnId }
        .mapNotNull { rc ->
            val rowKey = normalisedRowKeyMap[rc.name.normalise()]
            if (rowKey == null) {
                println("[RC] Column '${rc.name}' (${rc.columnId}) -> no match, skipping")
                null
            } else {
                println("[RC] Column '${rc.name}' (${rc.columnId}) -> '$rowKey'")
                rc to rowKey
            }
        }
        .filter { (_, rowKey) ->
            arr.any { !it.jsonObject[rowKey]?.jsonPrimitive?.contentOrNull.isNullOrBlank() }
        }

    println("[RC] Final RC columns: ${matchedColumns.map { (rc, _) -> "${rc.columnId}=${rc.name}" }}")

    // ---- 4. Fetch scripts for all rows upfront (before transaction) ----
    val scriptsByRowId = arr.associate { el ->
        val obj   = el.jsonObject
        val rowId = obj["RowID"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: -1
        val script = if (rowId > 0) fetchRcScript(config, rowId) else null
        println("[RC] Script for row $rowId: ${if (script != null) "${script.length} chars" else "none"}")
        rowId to (script ?: "")
    }

    // ---- 5. Persist everything in a single transaction ----
    return transaction {

        RowsTable.deleteWhere      { RowsTable.scheduleId    eq rundownId }
        ColumnsTable.deleteWhere   { ColumnsTable.scheduleId eq rundownId }
        SchedulesTable.deleteWhere { SchedulesTable.id       eq rundownId }

        SchedulesTable.upsert(SchedulesTable.id) {
            it[id]           = rundownId
            it[name]         = rundownTitle
            it[slug]         = rundownTitle.lowercase().replace(" ", "_")
            it[programStart] = System.currentTimeMillis()
        }

        // Insert system columns
        val systemColumnDefs = listOf(
            SystemColumns.PAGE     to "Text",
            SystemColumns.TITLE    to "Text",
            SystemColumns.DURATION to "Duration",
            SystemColumns.SCRIPT   to "Text",
        )

        val systemColumnIds = systemColumnDefs.mapIndexed { index, (colName, colType) ->
            val newId = ColumnsTable.insert {
                it[scheduleId] = rundownId
                it[order]      = index
                it[name]       = colName
                it[type]       = colType
                it[system]     = true
                it[hidden]     = colName == "script"
            } get ColumnsTable.id
            colName to newId
        }.toMap()

        // Insert RC columns, remap RC API id -> new DB auto-increment id
        val rcColumnOffset = systemColumnDefs.size
        val rcColumnIdMap  = mutableMapOf<Int, Int>()

        matchedColumns.forEachIndexed { index, (rc, _) ->
            val newDbId = ColumnsTable.insert {
                it[scheduleId] = rundownId
                it[order]      = rcColumnOffset + index
                it[name]       = rc.name
                it[type]       = "Text"
                it[system]     = false
            } get ColumnsTable.id

            rcColumnIdMap[rc.columnId] = newDbId
            println("[RC] Mapped RC col ${rc.columnId}='${rc.name}' -> DB id $newDbId")
        }

        // Re-read all columns with final correct IDs
        val allColumns = ColumnsTable
            .select { ColumnsTable.scheduleId eq rundownId }
            .orderBy(ColumnsTable.order to SortOrder.ASC)
            .map {
                Column(
                    id     = it[ColumnsTable.id],
                    name   = it[ColumnsTable.name],
                    type   = it[ColumnsTable.type],
                    order  = it[ColumnsTable.order],
                    system = it[ColumnsTable.system],
                    hidden = it[ColumnsTable.hidden],
                )
            }

        val pageColId     = systemColumnIds[SystemColumns.PAGE]
        val titleColId    = systemColumnIds[SystemColumns.TITLE]
        val durationColId = systemColumnIds[SystemColumns.DURATION]
        val scriptColId   = systemColumnIds[SystemColumns.SCRIPT]

        val rows = arr.mapIndexed { rowIndex, el ->
            val obj = el.jsonObject

            val rowId         = obj["RowID"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: rowIndex
            val pageValue     = obj["PageNumber"]?.jsonPrimitive?.contentOrNull ?: "A$rowIndex"
            val titleValue    = obj["StorySlug"]?.jsonPrimitive?.contentOrNull ?: ""
            val durationValue = (obj["EstimatedDuration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L) * 1000L
            val scriptValue   = scriptsByRowId[rowId] ?: ""

            val cells = LinkedHashMap<Int, CellValue>()

            pageColId?.let     { cells[it] = CellValue.Text(pageValue) }
            titleColId?.let    { cells[it] = CellValue.Text(titleValue) }
            durationColId?.let { cells[it] = CellValue.Number(durationValue.toDouble()) }
            scriptColId?.let   { cells[it] = CellValue.Text(scriptValue) }

            matchedColumns.forEach { (rc, rowKey) ->
                val dbColId = rcColumnIdMap[rc.columnId] ?: return@forEach
                val value = obj[rowKey]?.jsonPrimitive?.contentOrNull ?: ""
                cells[dbColId] = CellValue.Text(value)
            }

            println("[RC] Row $rowIndex id=$rowId: ${cells.size} cells, ids=${cells.keys}")

            RowsTable.insert {
                it[id]              = rowId
                it[scheduleId]      = rundownId
                it[order]           = rowIndex
                it[RowsTable.cells] = cells
            }

            Row(id = rowId, order = rowIndex, cells = cells)
        }

        val schedule = Schedule(
            id           = rundownId,
            name         = rundownTitle,
            programStart = System.currentTimeMillis(),
            rows         = rows,
            columns      = allColumns,
        )

        ScheduleStore.set(rundownId, schedule)
        schedule
    }
}

private fun parseTimeToMillis(text: String): Long {
    val parts = text.split(":").mapNotNull { it.toLongOrNull() }
    if (parts.size != 3) { println("[CSV] Invalid time format: $text"); return 0 }
    val (h, m, s) = parts
    val ms = (h * 3600 + m * 60 + s) * 1000
    println("[CSV] Time parsed [$text] -> $ms ms")
    return ms
}