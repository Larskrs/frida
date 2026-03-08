package com.example.websocket

import com.example.data.ColumnsTable
import data.CellValue
import data.Column
import data.Row
import data.SystemColumns
import data.durationMs
import com.example.data.RowsTable
import data.Schedule
import com.example.data.ScheduleRepository
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.serialization.json.Json
import com.example.data.ScheduleStore
import com.example.nextFullSecond
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

suspend fun initialLoad(scheduleId: Int, session: DefaultWebSocketServerSession) {
    val schedule = ScheduleStore.get(scheduleId) ?: return
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

                    println("Editing ${scheduleId} row: ${event.rowId}")

                    val current = ScheduleStore.get(scheduleId)
                        ?: ScheduleRepository.get(scheduleId)
                        ?: continue

                    val updatedRows = current.rows.map { row ->
                        if (row.id != event.rowId) return@map row

                        val newCells = row.cells.toMutableMap()
                        newCells[event.columnId] = event.cell
                        row.copy(cells = newCells)
                    }

                    val updatedSchedule = current.copy(rows = updatedRows)

                    ScheduleStore.set(scheduleId, updatedSchedule)
                    ScheduleRepository.save(updatedSchedule)

                    broadcast(
                        scheduleId,
                        ScheduleEvent.RowEdited(
                            rowId      = event.rowId,
                            columnId   = event.columnId,
                            cell       = event.cell
                        )
                    )
                }

                is ScheduleEvent.StartProgramAtRow -> {
                    val current = ScheduleStore.get(scheduleId) ?: continue
                    val now = nextFullSecond()

                    val rows = current.rows
                    val selectedIndex = rows.indexOfFirst { it.id == event.rowId }
                    if (selectedIndex == -1) return

                    val cumulativeBeforeAndCurrent = rows
                        .take(selectedIndex)
                        .sumOf { it.durationMs(current) }

                    val newProgramStart = now - cumulativeBeforeAndCurrent

                    var runningOffset = 0L

                    val newRows = rows.mapIndexed { index, row ->
                        val dur = row.durationMs(current)

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
                        activeRowId  = event.rowId,
                        rows         = newRows
                    )
                    ScheduleStore.set(scheduleId, updated)
                    broadcast(scheduleId, ScheduleEvent.Load(scheduleId, updated))
                }

                is ScheduleEvent.ProgramStartChanged -> {
                    val current = ScheduleStore.get(scheduleId) ?: continue

                    val isNow = event.programStart == 0L
                    val start = if (isNow) nextFullSecond() else event.programStart

                    val updated = if (isNow) {
                        val firstId = current.rows.firstOrNull()?.id

                        val newRows = current.rows.mapIndexed { index, row ->
                            if (index == 0) row.copy(activatedAt = start)
                            else row.copy(activatedAt = 0)
                        }

                        current.copy(
                            programStart = start,
                            activeRowId  = firstId,
                            rows         = newRows
                        )
                    } else {
                        current.copy(
                            programStart = start,
                            activeRowId  = null,
                            rows         = current.rows.map { it.copy(activatedAt = 0) }
                        )
                    }

                    ScheduleStore.set(scheduleId, updated)
                    broadcast(scheduleId, ScheduleEvent.Load(scheduleId, updated))
                }

                is ScheduleEvent.RowCreate -> {

                    val current = ScheduleStore.get(scheduleId)
                        ?: ScheduleRepository.get(scheduleId)
                        ?: continue

                    val updated = insertRowAtOrder(current, event.order)
                    updated.activeRowId = current.activeRowId

                    ScheduleStore.set(scheduleId, updated)
                    ScheduleRepository.save(updated)

                    broadcast(
                        scheduleId,
                        ScheduleEvent.Load(scheduleId = scheduleId, schedule = updated)
                    )
                }

                is ScheduleEvent.ColumnCreate -> {

                    val current = ScheduleStore.get(scheduleId)
                        ?: ScheduleRepository.get(scheduleId)
                        ?: continue

                    val updated = insertColumnAtOrder(
                        schedule    = current,
                        targetOrder = event.order,
                        name        = event.name ?: "New Column",
                        type        = event.columnType ?: "Text"
                    )

                    ScheduleStore.set(scheduleId, updated)
                    ScheduleRepository.save(updated)

                    broadcast(
                        scheduleId,
                        ScheduleEvent.Load(scheduleId = scheduleId, schedule = updated)
                    )
                }

                is ScheduleEvent.RowDelete -> {

                    val current = ScheduleStore.get(scheduleId)
                        ?: ScheduleRepository.get(scheduleId)
                        ?: continue

                    transaction {
                        RowsTable.deleteWhere { RowsTable.id eq event.rowId }
                    }

                    val normalized = current.rows
                        .filterNot { it.id == event.rowId }
                        .sortedBy { it.order }
                        .mapIndexed { index, row -> row.copy(order = index) }

                    val updated = current.copy(rows = normalized)

                    ScheduleStore.set(scheduleId, updated)
                    ScheduleRepository.save(updated)

                    broadcast(
                        scheduleId,
                        ScheduleEvent.Load(scheduleId = scheduleId, schedule = updated)
                    )
                }

                is ScheduleEvent.ColumnDelete -> {

                    val current = ScheduleStore.get(scheduleId)
                        ?: ScheduleRepository.get(scheduleId)
                        ?: continue

                    // Guard: system columns cannot be deleted
                    val col = current.columns.find { it.id == event.columnId }
                    if (col?.system == true) {
                        println("Refusing to delete system column ${col.name}")
                        continue
                    }

                    transaction {
                        ColumnsTable.deleteWhere { ColumnsTable.id eq event.columnId }
                    }

                    val normalizedColumns = current.columns
                        .filterNot { it.id == event.columnId }
                        .sortedBy { it.order }
                        .mapIndexed { index, column -> column.copy(order = index) }

                    val updatedRows = current.rows.map { row ->
                        row.copy(cells = row.cells.filterKeys { it != event.columnId }.toMutableMap())
                    }

                    val updatedSchedule = current.copy(columns = normalizedColumns, rows = updatedRows)

                    ScheduleStore.set(scheduleId, updatedSchedule)
                    ScheduleRepository.save(updatedSchedule)

                    broadcast(
                        scheduleId,
                        ScheduleEvent.Load(scheduleId = scheduleId, schedule = updatedSchedule)
                    )
                }

                is ScheduleEvent.ColumnEdited -> {

                    println("Editing column ${event.columnId}")

                    val current = ScheduleStore.get(scheduleId)
                        ?: ScheduleRepository.get(scheduleId)
                        ?: continue

                    // Guard: system columns cannot be renamed
                    val col = current.columns.find { it.id == event.columnId }
                    if (col?.system == true) {
                        println("Refusing to rename system column ${col.name}")
                        continue
                    }

                    transaction {
                        ColumnsTable.update({ ColumnsTable.id eq event.columnId }) {
                            it[ColumnsTable.name] = event.name
                            it[ColumnsTable.type] = event.columnType
                        }
                    }

                    val updatedColumns = current.columns.map { c ->
                        if (c.id == event.columnId) c.copy(name = event.name, type = event.columnType)
                        else c
                    }

                    val updatedSchedule = current.copy(columns = updatedColumns)

                    ScheduleStore.set(scheduleId, updatedSchedule)
                    ScheduleRepository.save(updatedSchedule)

                    broadcast(scheduleId, event)
                }

                is ScheduleEvent.ActiveRowChanged -> {
                    event.activatedAt = nextFullSecond()
                    val current = ScheduleStore.get(scheduleId) ?: continue

                    val newRows = current.rows.map { row ->
                        if (row.id == event.rowId) row.copy(activatedAt = event.activatedAt)
                        else row
                    }

                    val updatedSchedule = current.copy(activeRowId = event.rowId, rows = newRows)

                    ScheduleStore.set(scheduleId, updatedSchedule)
                    ScheduleRepository.save(updatedSchedule)

                    broadcast(scheduleId, event)
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

        // Build default cells for all system columns
        val defaultCells: Map<Int, CellValue> = schedule.columns
            .filter { it.system }
            .associate { col ->
                col.id to when (col.name) {
                    SystemColumns.DURATION -> CellValue.Number(1000.0)
                    SystemColumns.PAGE     -> CellValue.Text("A$safeOrder")
                    else                   -> CellValue.Text("")
                }
            }

        val newId = RowsTable.insert {
            it[scheduleId] = schedule.id
            it[order]      = safeOrder
            it[cells]      = defaultCells
        } get RowsTable.id

        val rows = RowsTable
            .select { RowsTable.scheduleId eq schedule.id }
            .orderBy(RowsTable.order to SortOrder.ASC)
            .map {
                Row(
                    id    = it[RowsTable.id],
                    order = it[RowsTable.order],
                    cells = it[RowsTable.cells],
                )
            }

        schedule.copy(rows = rows)
    }
}

fun insertColumnAtOrder(
    schedule: Schedule,
    targetOrder: Int,
    name: String,
    type: String,
    system: Boolean = false,
    hidden: Boolean = false,
): Schedule {

    return transaction {

        val safeOrder = targetOrder.coerceAtLeast(0)

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

        ColumnsTable.insert {
            it[scheduleId]      = schedule.id
            it[order]           = safeOrder
            it[ColumnsTable.name]   = name
            it[ColumnsTable.type]   = type
            it[ColumnsTable.system] = system
            it[ColumnsTable.hidden] = hidden
        }

        val columns = ColumnsTable
            .select { ColumnsTable.scheduleId eq schedule.id }
            .orderBy(ColumnsTable.order to SortOrder.ASC)
            .map {
                Column(
                    id     = it[ColumnsTable.id],
                    name   = it[ColumnsTable.name],
                    order  = it[ColumnsTable.order],
                    type   = it[ColumnsTable.type],
                    system = it[ColumnsTable.system],
                    hidden = it[ColumnsTable.hidden],
                )
            }

        schedule.copy(columns = columns)
    }
}