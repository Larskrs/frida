package com.example

import com.example.config.AppConfig
import com.example.config.ConfigManager
import com.example.data.dumpRundownRawCsv
import com.example.data.resolveSchedule
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

fun main(args: Array<String>) {

    println("Booting application...")

    val isDev = System.getenv("DEV_MODE") == "true"
    println("Currently running in ${if (isDev) "development" else "production"}")

    var config = ConfigManager.loadOrCreate()

    dumpRundownRawCsv(config)

    val resolved = resolveSchedule(args)
    val scheduleFile = resolved.file
    config = resolved.updatedConfig

    println("Schedule loaded: ${scheduleFile.name}")

    startServer(config.port, scheduleFile)
}

fun testEndpoint(config: AppConfig) {
    try {
        val url = "${config.rundownUrl}" +
                "?APIKey=${config.rundownKey}" +
                "&APIToken=${config.rundownToken}" +
                "&Action=getRundowns"

        println("Testing Rundown API:")
        println(url)

        val req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()

        val http = HttpClient.newHttpClient()

        val resp = http.send(req, HttpResponse.BodyHandlers.ofString())

        println("Status: ${resp.statusCode()}")

        val body = resp.body()
        println("Body length: ${body.length}")

        // Print only first 500 chars to avoid spam
        println("Body preview:")
        println(body.take(500))

    } catch (e: Exception) {
        println("Endpoint test failed:")
        e.printStackTrace()
    }
}

