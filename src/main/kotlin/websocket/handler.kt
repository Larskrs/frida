package com.example.websocket

import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import com.example.data.ScheduleStore

val json = Json {
    ignoreUnknownKeys = true
    classDiscriminator = "type"
}

val sessions = mutableSetOf<DefaultWebSocketServerSession>()

suspend fun broadcast(event: ScheduleEvent) {
    val payload = json.encodeToString(event)
    sessions.forEach {
        it.send(Frame.Text(payload))
    }
}

suspend fun handleSocket(session: DefaultWebSocketServerSession) {
    sessions += session

    try {
        // 1. SEND INITIAL STATE ONLY TO THIS CLIENT
        val loadEvent = ScheduleEvent.Load(ScheduleStore.get())
        val payload = json.encodeToString<ScheduleEvent>(loadEvent)
        session.send(Frame.Text(payload))

        println("Sent event payload: $payload")

        // 2. LISTEN FOR EVENTS FROM THIS CLIENT
        for (frame in session.incoming) {
            frame as? Frame.Text ?: continue
            val event = json.decodeFromString<ScheduleEvent>(frame.readText())

            when (event) {

                is ScheduleEvent.ColumnEdited -> {
                    // TODO: mutate store later
                    broadcast(event)
                }

                is ScheduleEvent.ActiveColumnChanged -> {
                    val s = ScheduleStore.get()
                    s.activeColumnId = event.columnId
                    ScheduleStore.set(s)
                    broadcast(event)
                }

                else -> {}
            }
        }

    } finally {
        sessions -= session
    }
}
