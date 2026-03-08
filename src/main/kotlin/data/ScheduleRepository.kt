package com.example.data

import data.Row
import data.Schedule
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.Locale.getDefault

object ScheduleRepository {

    /* -------------------- GET ALL -------------------- */

    fun getAll(): List<Schedule> = transaction {
        SchedulesTable
            .selectAll()
            .map { toSchedule(it) }
    }

    /* -------------------- GET ONE -------------------- */

    fun get(id: Int): Schedule? = transaction {
        SchedulesTable
            .selectAll().where { SchedulesTable.id eq id }
            .map { toSchedule(it) }
            .singleOrNull()
    }

    /* -------------------- SAVE / UPSERT -------------------- */

    fun save(schedule: Schedule) = transaction {

        val scheduleId = run {
            SchedulesTable.update({ SchedulesTable.id eq schedule.id }) {
                it[name] = schedule.name
                it[slug] = schedule.name.lowercase(getDefault()).replace(" ", "_")
                it[programStart] = schedule.programStart
            }
            schedule.id
        }

        val scheduleEntityId = EntityID(scheduleId, SchedulesTable)

        /* Remove old rows */
        RowsTable.deleteWhere { RowsTable.scheduleId eq scheduleId }

        /* Insert new rows */
        schedule.rows.forEachIndexed { index, row ->
            RowsTable.insert {
                it[id]         = row.id
                it[order]      = index
                it[RowsTable.scheduleId] = scheduleEntityId
                it[cells]      = row.cells
            }
        }

        ColumnsTable.deleteWhere { ColumnsTable.scheduleId eq scheduleId }

        schedule.columns.forEachIndexed { index, column ->
            ColumnsTable.insert {
                it[id]         = column.id
                it[name]       = column.name
                it[order]      = index
                it[type]       = column.type
                it[system]     = column.system
                it[ColumnsTable.scheduleId] = scheduleEntityId
            }
        }

        ScheduleStore.reload(schedule)
    }

    /* -------------------- DELETE -------------------- */

    fun delete(id: Int) = transaction {
        RowsTable.deleteWhere { RowsTable.scheduleId eq id }
        SchedulesTable.deleteWhere { SchedulesTable.id eq id }
    }

    /* -------------------- ARCHIVE -------------------- */

    fun archive(id: Int, archived: Boolean = true) = transaction {
        SchedulesTable.update({ SchedulesTable.id eq id }) {
            it[isArchived] = archived
        }
    }

    /* -------------------- INTERNAL MAPPERS -------------------- */

    private fun toSchedule(row: ResultRow): Schedule {
        val scheduleId = row[SchedulesTable.id].value

        val rows = RowsTable
            .select { RowsTable.scheduleId eq scheduleId }
            .orderBy(RowsTable.order to SortOrder.ASC)
            .map { toRow(it) }

        val columns = ColumnsTable
            .select { ColumnsTable.scheduleId eq scheduleId }
            .orderBy(ColumnsTable.order to SortOrder.ASC)
            .map { toColumn(it) }

        return Schedule(
            id           = scheduleId,
            name         = row[SchedulesTable.name],
            programStart = row[SchedulesTable.programStart],
            rows         = rows,
            columns      = columns
        )
    }

    private fun toRow(row: ResultRow): Row {
        return Row(
            id    = row[RowsTable.id],
            order = row[RowsTable.order],
            cells = row[RowsTable.cells],
        )
    }

    private fun toColumn(col: ResultRow): data.Column {
        return data.Column(
            id     = col[ColumnsTable.id],
            name   = col[ColumnsTable.name],
            type   = col[ColumnsTable.type],
            order  = col[ColumnsTable.order],
            system = col[ColumnsTable.system],
        )
    }
}