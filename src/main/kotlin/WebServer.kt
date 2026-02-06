package com.example

import com.example.config.AppPaths.isDev
import com.example.websocket.ScheduleTicker
import io.ktor.server.application.*
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.routing.routing
import io.ktor.server.websocket.*
import kotlinx.serialization.json.Json
import routes.scheduleRoutes
import java.io.File

fun Application.module(scheduleFile: File) {
    install(WebSockets) {
        Json { ignoreUnknownKeys = true }
    }
//    ScheduleTicker.start(this)
    routing {
        scheduleRoutes()
    }
}

fun startServer(port: Int, scheduleFile: File) {

    embeddedServer(Netty, port = port) {
        module(scheduleFile)
    }.start(wait = true)
}