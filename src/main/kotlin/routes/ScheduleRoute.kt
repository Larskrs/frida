package routes

import com.example.websocket.handleSocket
import io.ktor.server.http.content.staticResources
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.websocket.webSocket

fun Route.scheduleRoutes() {

    staticResources("schedule", "schedule")

    webSocket("/schedule/ws") {
        handleSocket(this)
    }
}