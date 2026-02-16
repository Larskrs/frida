package com.example.data

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

        /* Remove old rows */
        RowsTable.deleteWhere { RowsTable.scheduleId eq scheduleId }

        val scheduleEntityId = EntityID(scheduleId, SchedulesTable)
        /* Insert new rows */
        schedule.rows.forEachIndexed { index, row ->
            RowsTable.insert {
                it[id] = row.id
                it[order] = index
                it[page] = row.page
                it[RowsTable.scheduleId] = scheduleEntityId
                it[title] = row.title
                it[duration] = row.duration
                it[script] = row.script
                it[cells] = row.cells
            }
        }
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

        return Schedule(
            id = scheduleId,
            name = row[SchedulesTable.name],
            programStart = row[SchedulesTable.programStart],
            rows = rows
        )
    }

    private fun toRow(row: ResultRow): Row {
        return Row(
            id = row[RowsTable.id],
            page = row[RowsTable.page],
            title = row[RowsTable.title],
            duration = row[RowsTable.duration],
            script = row[RowsTable.script],
            cells = row[RowsTable.cells],
            order = row[RowsTable.order],
        )
    }
}
