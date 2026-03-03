package routes

import com.example.websocket.handleSocket
import io.ktor.server.http.content.default
import io.ktor.server.http.content.staticFiles
import io.ktor.server.http.content.staticResources
import io.ktor.server.response.respondFile
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.websocket.webSocket
import java.io.File

fun Route.scheduleRoutes() {

    staticResources("schedule", "src/schedule")
    staticResources("chat", "src/chat")

    staticResources("/", "frontend/dist") {
        default("index.html")
    }


    webSocket("/schedule/ws/{id}") {
        handleSocket(this)
    }
}