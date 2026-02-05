package com.example.websocket

import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import com.example.data.ScheduleStore
import com.example.nextFullSecond
import java.time.Instant

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

                is ScheduleEvent.ProgramStartChanged -> {
                    val current = ScheduleStore.get()

                    val start = nextFullSecond()

                    val firstId = current.columns.firstOrNull()?.id

                    val newColumns = current.columns.mapIndexed { index, col ->
                        if (index == 0) {
                            col.copy(activatedAt = start)
                        } else {
                            col.copy(activatedAt = 0)
                        }
                    }

                    val updated = current.copy(
                        programStart = start,
                        activeColumnId = firstId,
                        columns = newColumns
                    )

                    ScheduleStore.set(updated)

                    broadcast(ScheduleEvent.Load(updated))
                }


                is ScheduleEvent.ActiveColumnChanged -> {
                    event.activatedAt = Instant.now().toEpochMilli()
                    val current = ScheduleStore.get()

                    val newColumns = current.columns.map { col ->
                        if (col.id == event.columnId) {
                            col.copy(activatedAt = event.activatedAt)
                        } else {
                            col
                        }
                    }

                    val updatedSchedule = current.copy(
                        activeColumnId = event.columnId,
                        columns = newColumns
                    )

                    ScheduleStore.set(updatedSchedule)

                    broadcast(event)
                }

                else -> {}
            }
        }

    } finally {
        sessions -= session
    }
}
