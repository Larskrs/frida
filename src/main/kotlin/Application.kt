package com.example

import io.ktor.server.application.*
import io.ktor.server.websocket.*
import kotlinx.serialization.json.Json

fun Application.module() {
    install(WebSockets) {
        Json { ignoreUnknownKeys = true }
    }
    configureRouting()
}
