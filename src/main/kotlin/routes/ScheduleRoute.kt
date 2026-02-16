package routes

import com.example.websocket.handleSocket
import io.ktor.server.http.content.staticResources
import io.ktor.server.routing.Route
import io.ktor.server.websocket.webSocket

fun Route.scheduleRoutes() {

    staticResources("schedule", "src/schedule")
    staticResources("chat", "src/chat")

    webSocket("/schedule/ws/{id}") {
        handleSocket(this)
    }
}