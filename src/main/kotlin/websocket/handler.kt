package com.example.websocket

import com.example.config.ConfigManager
import com.example.data.CellValue
import com.example.data.Row
import com.example.data.Schedule
import com.example.data.ScheduleRepository
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import com.example.data.ScheduleStore
import com.example.data.loadColumnsFromRundown
import com.example.nextFullSecond
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
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

        // 2. LISTEN FOR EVENTS FROM THIS CLIENT
        for (frame in session.incoming) {
            frame as? Frame.Text ?: continue
            println(json.encodeToString(frame.readText()))
            when (val event = json.decodeFromString<ScheduleEvent>(frame.readText())) {

                is ScheduleEvent.RequestLoad -> {

                    val schedule = ScheduleRepository.get(event.scheduleId)
                    println("Received request for ${event.scheduleId}")

                    val response = if (schedule != null) {
                        ScheduleEvent.Load(
                            scheduleId = event.scheduleId,
                            schedule = schedule
                        )
                    } else {
                        ScheduleEvent.Load(
                            scheduleId = event.scheduleId,
                            schedule = null,
                            error = "Schedule not found"
                        )
                    }

                    session.send(Frame.Text(json.encodeToString(response)))
                    broadcast(response)
                }

                is ScheduleEvent.RowEdited -> {

                    println("Editing ${event.scheduleId} row: ${event.rowId}")

                    val current = ScheduleStore.get(event.scheduleId)
                        ?: ScheduleRepository.get(event.scheduleId)
                        ?: continue



                    val updatedRows = current.rows.map { row ->
                        if (row.id != event.rowId) return@map row

                        // ----- TOP LEVEL FIELDS -----
                        if (event.cell == null) {
                            when (event.key) {
                                "title" -> row.copy(title = event.value.asString() ?: "")
                                "page" -> row.copy(page = event.value.asString() ?: "")
                                "script" -> row.copy(script = event.value.asString() ?: "")
                                "duration" -> row.copy(duration = event.value.asLong() ?: row.duration)
                                else -> row
                            }
                        }

                        // ----- CELL PATCH -----
                        else {
                            val newCells = row.cells.toMutableMap()
                            newCells[event.key] = event.cell
                            row.copy(cells = newCells)
                        }
                    }

                    val updatedSchedule = current.copy(rows = updatedRows)

                    // ---- STORE IN MEMORY ----
                    ScheduleStore.set(event.scheduleId, updatedSchedule)

                    // ---- PERSIST ----
                    ScheduleRepository.save(updatedSchedule)

                    // ---- BROADCAST PATCH + LOAD ----
                    broadcast(
                        ScheduleEvent.RowEdited(
                            scheduleId = event.scheduleId,
                            rowId = event.rowId,
                            key = event.key,
                            value = event.value,
                            cell = event.cell
                        )
                    )

                    broadcast(
                        ScheduleEvent.Load(
                            scheduleId = event.scheduleId,
                            schedule = updatedSchedule
                        )
                    )
                }

                is ScheduleEvent.StartProgramAtRow -> {
                    val current = ScheduleStore.get(event.scheduleId) ?: continue
                    val now = nextFullSecond()

                    val rows = current.rows
                    val selectedIndex = rows.indexOfFirst { it.id == event.rowId }
                    if (selectedIndex == -1) return

                    fun durationMs(row: Row): Long {
                        return row.duration
                    }

                    val cumulativeBeforeAndCurrent = rows
                        .take(selectedIndex)
                        .sumOf { durationMs(it) }

                    val newProgramStart = now - cumulativeBeforeAndCurrent

                    var runningOffset = 0L

                    val newRows = rows.mapIndexed { index, row ->
                        val dur = durationMs(row)

                        if (index <= selectedIndex) {
                            val activated = newProgramStart + runningOffset
                            runningOffset += dur
                            row.copy(activatedAt = activated)
                        } else {
                            row.copy(activatedAt = 0)
                        }
                    }

                    val updated = current.copy(
                        programStart = newProgramStart,
                        activeRowId = event.rowId,
                        rows = newRows
                    )
                    ScheduleStore.set(event.scheduleId, updated)
                    broadcast(ScheduleEvent.Load(event.scheduleId, updated))
                }

                is ScheduleEvent.ProgramStartChanged -> {
                    val current = ScheduleStore.get(event.scheduleId) ?: continue

                    val isNow = event.programStart == 0L
                    val start = if (isNow) nextFullSecond() else event.programStart

                    val updated = if (isNow) {
                        // FORCE first column active
                        val firstId = current.rows.firstOrNull()?.id

                        val newColumns = current.rows.mapIndexed { index, col ->
                            if (index == 0) {
                                col.copy(activatedAt = start)
                            } else {
                                col.copy(activatedAt = 0)
                            }
                        }

                        current.copy(
                            programStart = start,
                            activeRowId = firstId,
                            rows = newColumns
                        )
                    } else {
                        // DO NOT force activation
                        current.copy(
                            programStart = start,
                            activeRowId = null,
                            rows = current.rows.map {
                                it.copy(activatedAt = 0)
                            }
                        )
                    }

                    ScheduleStore.set(event.scheduleId, updated)
                    broadcast(ScheduleEvent.Load(event.scheduleId, updated))
                }



                is ScheduleEvent.ActiveRowChanged -> {
                    event.activatedAt = Instant.now().toEpochMilli()
                    val current = ScheduleStore.get(event.scheduleId) ?: continue

                    val newColumns = current.rows.map { col ->
                        if (col.id == event.rowId) {
                            col.copy(activatedAt = event.activatedAt)
                        } else {
                            col
                        }
                    }

                    val updatedSchedule = current.copy(
                        activeRowId = event.rowId,
                        rows = newColumns
                    )

                    ScheduleStore.set(event.scheduleId, updatedSchedule)

                    broadcast(event)
                }

                else -> {}
            }
        }

    } finally {
        sessions -= session
    }
}


fun JsonElement?.asString(): String? =
    this?.jsonPrimitive?.contentOrNull

fun JsonElement?.asLong(): Long? =
    this?.jsonPrimitive?.longOrNull