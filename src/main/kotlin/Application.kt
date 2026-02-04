package com.example

import io.ktor.server.application.*
import io.ktor.server.routing.routing
import io.ktor.server.websocket.*
import kotlinx.serialization.json.Json
import routes.scheduleRoutes

fun Application.module() {
    install(WebSockets) {
        Json { ignoreUnknownKeys = true }
    }
    routing {
        scheduleRoutes()
    }
}
