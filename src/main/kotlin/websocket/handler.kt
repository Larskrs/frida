package com.example.websocket

import com.example.data.ColumnsTable
import data.CellValue
import data.Row
import com.example.data.RowsTable
import data.Schedule
import com.example.data.ScheduleRepository
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.serialization.json.Json
import com.example.data.ScheduleStore
import com.example.nextFullSecond
import data.Column
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update

val json = Json {
    ignoreUnknownKeys = true
    classDiscriminator = "type"
}

val rooms = mutableMapOf<Int, MutableSet<DefaultWebSocketServerSession>>()
fun room(id: Int) = rooms.getOrPut(id) { mutableSetOf() }

suspend fun broadcast(scheduleId: Int, event: ScheduleEvent) {
    val payload = json.encodeToString(event)
    rooms[scheduleId]?.forEach {
        it.send(Frame.Text(payload))
    }
}

suspend fun initialLoad (scheduleId: Int, session: DefaultWebSocketServerSession) {
    val schedule = ScheduleStore.get(scheduleId)

    val payload: ScheduleEvent = ScheduleEvent.Load(scheduleId, schedule)
    session.send(Frame.Text(json.encodeToString(payload)))
}

suspend fun handleSocket(session: DefaultWebSocketServerSession) {
    val scheduleId = session.call.parameters["id"]?.toIntOrNull() ?: return
    val room = room(scheduleId)
    room += session

    initialLoad(scheduleId, session)

    try {

        for (frame in session.incoming) {
            frame as? Frame.Text ?: continue
            println(json.encodeToString(frame.readText()))
            when (val event = json.decodeFromString<ScheduleEvent>(frame.readText())) {

                is ScheduleEvent.RowEdited -> {

                    println("Editing ${event.scheduleId} row: ${event.rowId}")

                    val current = ScheduleStore.get(event.scheduleId)
                        ?: ScheduleRepository.get(event.scheduleId)
                        ?: continue

                    val updatedRows = current.rows.map { row ->
                        if (row.id != event.rowId) return@map row

                        // 🔹 TOP LEVEL FIELDS
                        if (event.columnId == null) {

                            when (event.key) {
                                "title" -> row.copy(title = event.value.asString() ?: "")
                                "page" -> row.copy(page = event.value.asString() ?: "")
                                "script" -> row.copy(script = event.value.asString() ?: "")
                                "duration" -> row.copy(duration = event.value.asLong() ?: row.duration)
                                else -> row
                            }

                        }
                        // 🔹 COLUMN CELL PATCH
                        else {

                            val newCells = row.cells.toMutableMap()
                            newCells[event.columnId] = event.cell!!
                            row.copy(cells = newCells)
                        }
                    }

                    val updatedSchedule = current.copy(rows = updatedRows)

                    // ---- STORE ----
                    ScheduleStore.set(event.scheduleId, updatedSchedule)

                    // ---- PERSIST ----
                    ScheduleRepository.save(updatedSchedule)

                    // ---- BROADCAST PATCH ----
                    broadcast(
                        event.scheduleId,
                        ScheduleEvent.RowEdited(
                            scheduleId = event.scheduleId,
                            rowId = event.rowId,
                            key = event.key,
                            columnId = event.columnId,
                            value = event.value,
                            cell = event.cell
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
                    broadcast(event.scheduleId, ScheduleEvent.Load(event.scheduleId, updated))
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
                    broadcast(event.scheduleId, ScheduleEvent.Load(event.scheduleId, updated))
                }

                is ScheduleEvent.RowCreate -> {

                    val current = ScheduleStore.get(event.scheduleId)
                        ?: ScheduleRepository.get(event.scheduleId)
                        ?: continue

                    val updated = insertRowAtOrder(current, event.order)
                    updated.activeRowId = current.activeRowId

                    // ---- STORE ----
                    ScheduleStore.set(event.scheduleId, updated)

                    // ---- PERSIST ----
                    ScheduleRepository.save(updated)

                    // ---- BROADCAST FULL LOAD ----
                    broadcast(
                        event.scheduleId,
                        ScheduleEvent.Load(
                            scheduleId = event.scheduleId,
                            schedule = updated
                        )
                    )
                }

                is ScheduleEvent.ColumnCreate -> {

                    val current = ScheduleStore.get(event.scheduleId)
                        ?: ScheduleRepository.get(event.scheduleId)
                        ?: continue

                    val updated = insertColumnAtOrder(
                        schedule = current,
                        targetOrder = event.order,
                        name = event.name ?: "New Column",
                        type = event.columnType ?: "Text"
                    )

                    // ---- STORE ----
                    ScheduleStore.set(event.scheduleId, updated)

                    // ---- PERSIST ----
                    ScheduleRepository.save(updated)

                    // ---- BROADCAST FULL LOAD ----
                    broadcast(
                        event.scheduleId,
                        ScheduleEvent.Load(
                            scheduleId = event.scheduleId,
                            schedule = updated
                        )
                    )
                }

                is ScheduleEvent.RowDelete -> {

                    val current = ScheduleStore.get(event.scheduleId)
                        ?: ScheduleRepository.get(event.scheduleId)
                        ?: continue

                    // 1. DELETE FROM DB
                    transaction {
                        RowsTable.deleteWhere { RowsTable.id eq event.rowId }
                    }

                    // 2. REMOVE FROM MEMORY
                    val filtered = current.rows
                        .filterNot { it.id == event.rowId }
                        .sortedBy { it.order }

                    // 3. NORMALIZE ORDER
                    val normalized = filtered.mapIndexed { index, row ->
                        row.copy(order = index)
                    }

                    val updated = current.copy(rows = normalized)

                    // 4. STORE + PERSIST
                    ScheduleStore.set(event.scheduleId, updated)
                    ScheduleRepository.save(updated)

                    // 5. BROADCAST
                    broadcast(
                        event.scheduleId,
                        ScheduleEvent.Load(
                            scheduleId = event.scheduleId,
                            schedule = updated
                        )
                    )
                }

                is ScheduleEvent.ColumnDelete -> {

                    val current = ScheduleStore.get(event.scheduleId)
                        ?: ScheduleRepository.get(event.scheduleId)
                        ?: continue

                    // 1️⃣ DELETE FROM DB
                    transaction {
                        ColumnsTable.deleteWhere { ColumnsTable.id eq event.columnId }
                    }

                    // 2️⃣ REMOVE COLUMN FROM MEMORY
                    val filteredColumns = current.columns
                        .filterNot { it.id == event.columnId }
                        .sortedBy { it.order }

                    // 3️⃣ NORMALIZE COLUMN ORDER
                    val normalizedColumns = filteredColumns.mapIndexed { index, column ->
                        column.copy(order = index)
                    }

                    // 4️⃣ REMOVE COLUMN CELLS FROM ALL ROWS
                    val updatedRows = current.rows.map { row ->
                        val newCells = row.cells
                            .filterKeys { it != event.columnId }
                            .toMutableMap()

                        row.copy(cells = newCells)
                    }

                    val updatedSchedule = current.copy(
                        columns = normalizedColumns,
                        rows = updatedRows
                    )

                    // 5️⃣ STORE + PERSIST
                    ScheduleStore.set(event.scheduleId, updatedSchedule)
                    ScheduleRepository.save(updatedSchedule)

                    // 6️⃣ BROADCAST FULL LOAD
                    broadcast(
                        event.scheduleId,
                        ScheduleEvent.Load(
                            scheduleId = event.scheduleId,
                            schedule = updatedSchedule
                        )
                    )
                }

                is ScheduleEvent.ColumnEdited -> {

                    println("Editing column ${event.columnId}")

                    println(event)

                    val current = ScheduleStore.get(event.scheduleId)
                        ?: ScheduleRepository.get(event.scheduleId)
                        ?: continue

                    // 1️⃣ UPDATE DB
                    transaction {
                        ColumnsTable.update(
                            where = { ColumnsTable.id eq event.columnId }
                        ) {
                            it[ColumnsTable.name] = event.name
                            it[ColumnsTable.type] = event.columnType
                        }
                    }

                    // 2️⃣ UPDATE MEMORY
                    val updatedColumns = current.columns.map { col ->
                        if (col.id == event.columnId) {
                            col.copy(
                                name = event.name,
                                type = event.columnType
                            )
                        } else col
                    }

                    val updatedSchedule = current.copy(columns = updatedColumns)

                    // 3️⃣ STORE + PERSIST
                    ScheduleStore.set(event.scheduleId, updatedSchedule)
                    ScheduleRepository.save(updatedSchedule)

                    // 4️⃣ BROADCAST PATCH
                    broadcast(
                        event.scheduleId,
                        event
                    )
                }


                is ScheduleEvent.ActiveRowChanged -> {
                    event.activatedAt = nextFullSecond()
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
                    ScheduleRepository.save(updatedSchedule)

                    broadcast(event.scheduleId,event)
                }

                else -> {}
            }
        }

    } finally {
        rooms[scheduleId]?.remove(session)
        if (rooms[scheduleId]?.isEmpty() == true)
            rooms.remove(scheduleId)
    }
}

fun insertRowAtOrder(schedule: Schedule, targetOrder: Int): Schedule {
    return transaction {

        val safeOrder = targetOrder.coerceAtLeast(0)

        RowsTable.update(
            where = {
                (RowsTable.scheduleId eq schedule.id) and
                        (RowsTable.order greaterEq safeOrder)
            }
        ) {
            with(SqlExpressionBuilder) {
                it.update(RowsTable.order, RowsTable.order + 1)
            }
        }

        // 2. Insert new row
        val newId = RowsTable.insert {
            it[scheduleId] = schedule.id
            it[order] = safeOrder
            it[cells] = emptyMap<Int, CellValue>()
            it[title] = "New Row"
            it[page] = "A$safeOrder"
            it[script] = ""
            it[duration] = 1000L
        } get RowsTable.id

        // 3. Re-read ONLY this schedule’s rows
        val rows = RowsTable
            .select { RowsTable.scheduleId eq schedule.id }
            .orderBy(RowsTable.order to SortOrder.ASC)
            .map {
                Row(
                    id = it[RowsTable.id],
                    title = it[RowsTable.title],
                    page = it[RowsTable.page],
                    script = it[RowsTable.script],
                    duration = it[RowsTable.duration],
                    cells = it[RowsTable.cells],
                    activatedAt = 0,
                    order = it[RowsTable.order]
                )
            }

        // 4. Return updated schedule
        schedule.copy(rows = rows)
    }
}

fun insertColumnAtOrder(
    schedule: Schedule,
    targetOrder: Int,
    name: String,
    type: String
): Schedule {

    return transaction {

        val safeOrder = targetOrder.coerceAtLeast(0)

        // 1️⃣ Shift existing columns
        ColumnsTable.update(
            where = {
                (ColumnsTable.scheduleId eq schedule.id) and
                        (ColumnsTable.order greaterEq safeOrder)
            }
        ) {
            with(SqlExpressionBuilder) {
                it.update(ColumnsTable.order, ColumnsTable.order + 1)
            }
        }

        // 2️⃣ Insert new column
        ColumnsTable.insert {
            it[scheduleId] = schedule.id
            it[order] = safeOrder
            it[ColumnsTable.name] = name
            it[ColumnsTable.type] = type
        }

        // 3️⃣ Re-read columns
        val columns = ColumnsTable
            .select { ColumnsTable.scheduleId eq schedule.id }
            .orderBy(ColumnsTable.order to SortOrder.ASC)
            .map {
                Column(
                    id = it[ColumnsTable.id],
                    name = it[ColumnsTable.name],
                    order = it[ColumnsTable.order],
                    type = it[ColumnsTable.type]
                )
            }

        // 4️⃣ Return updated schedule
        schedule.copy(columns = columns)
    }
}




fun JsonElement?.asString(): String? =
    this?.jsonPrimitive?.contentOrNull

fun JsonElement?.asLong(): Long? =
    this?.jsonPrimitive?.longOrNull

