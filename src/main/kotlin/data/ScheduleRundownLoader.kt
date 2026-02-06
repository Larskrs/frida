package com.example.data

import com.example.config.AppConfig
import com.example.config.ConfigManager
import com.example.escape
import com.example.websocket.json
import kotlinx.serialization.json.*
import java.io.File
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
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
        val excludedHeaders = arrayOf("RowID", "Approved", "Floated", "Locked", "Following", "ActualDuration", "Deleted", "sebbecues", "ScriptHasContent", "Position", "RundownID")

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

