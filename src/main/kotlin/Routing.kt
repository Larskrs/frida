package com.example

import io.ktor.server.application.*
import io.ktor.server.http.content.staticResources
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.*

data class Client(
    val name: String,
    val session: DefaultWebSocketServerSession
)

@Serializable
data class Message(
    val user: String,
    val content: String
)

val clients = Collections.synchronizedSet(mutableSetOf<Client>())
val mutex = Mutex()

fun Application.configureRouting() {
    routing {

        // --- Test Page ---
        staticResources("/static/", "static")

        // --- WebSocket ---
        webSocket("/chat") {
            send("Enter your name:")

            var clientName: String? = null

            try {
                for (frame in incoming) {
                    frame as? Frame.Text ?: continue
                    val text = frame.readText()

                    // First message = username
                    if (clientName == null) {
                        clientName = text.trim()
                        val client = Client(clientName!!, this)

                        mutex.withLock {
                            clients.add(client)
                        }

                        broadcast("SYSTEM", "$clientName joined")
                        continue
                    }

                    // Normal message
                    broadcast(clientName!!, text)
                }
            } finally {
                if (clientName != null) {
                    mutex.withLock {
                        clients.removeIf { it.session == this }
                    }
                    broadcast("SYSTEM", "$clientName left")
                }
            }
        }
    }
}

val json = Json {
    prettyPrint = false
    ignoreUnknownKeys = true
}

suspend fun broadcast(sender: String, message: String) {
    val payload = Message(sender, message)
    val encoded = json.encodeToString(payload)

    clients.forEach { client ->
        try {
            client.session.send(Frame.Text(encoded))
        } catch (_: Exception) {
            // ignore dead sessions
        }
    }
}
