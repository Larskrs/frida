package com.example

import com.example.routes.restRoutes
import com.example.websocket.ScheduleTicker
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.*
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.websocket.*
import kotlinx.serialization.json.Json
import routes.scheduleRoutes
import java.io.File

fun Application.module() {
    install(ContentNegotiation) {
      json(Json {
          ignoreUnknownKeys = true
          prettyPrint = true
      })
    }
    install(WebSockets) {
        Json { ignoreUnknownKeys = true }
    }
    routing {
        scheduleRoutes()
        restRoutes()
    }

}

fun startServer(port: Int) {
    embeddedServer(Netty, port = port) {
        module()
    }.start(wait = true)
}