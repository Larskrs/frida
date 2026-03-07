
package com.example.routes

import com.example.data.ColumnsTable
import com.example.data.DatabaseFactory
import com.example.data.RowsTable
import com.example.data.RundownRoutes.getRundowns
import com.example.data.ScheduleRepository
import com.example.data.ScheduleStore
import com.example.data.SchedulesTable
import com.example.data.getDbStatus
import com.example.data.loadRundownAsSchedule
import data.Schedule
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.upsert

fun Route.restRoutes() {

    get("/api/rundowns") {
        call.respond(
            getRundowns()
        )
    }
    get ( "/api/db" ) {
        call.respond(
            getDbStatus(
                dataSource = DatabaseFactory.hikariSource,
            )
        )
    }
    get("/api/schedules") {
        call.respond(
            ScheduleRepository.getAll()
        )
    }
    get("/api/schedule/{id}") {
        val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
        call.respond(
            ScheduleRepository.get(id) as Any
        )
    }

    post("/api/schedule/import/rc/{id}") {
        val rundownId = call.parameters["id"]?.toIntOrNull()
            ?: return@post call.respond(HttpStatusCode.BadRequest, "Invalid or missing rundown ID")

        val rundown = try {
            getRundowns().find { it.rundownId == rundownId }
        } catch (e: Exception) {
            return@post call.respond(HttpStatusCode.BadGateway, "Could not fetch rundown list: ${e.message}")
        } ?: return@post call.respond(HttpStatusCode.NotFound, "Rundown $rundownId not found")

        val (rows, columns) = try {
            loadRundownAsSchedule(rundownId)
        } catch (e: Exception) {
            return@post call.respond(HttpStatusCode.BadGateway, "Rundown fetch failed: ${e.message}")
        }

        println("$rows")
        println("$columns")

        transaction {
            RowsTable.deleteWhere { RowsTable.scheduleId eq rundownId }
            ColumnsTable.deleteWhere { ColumnsTable.scheduleId eq rundownId }
            SchedulesTable.deleteWhere { SchedulesTable.id eq rundownId }
        }

        // Insert the schedule row first so the FK exists
        transaction {
            SchedulesTable.upsert(SchedulesTable.id) {
                it[id]           = rundownId
                it[name]         = rundown.title
                it[slug]         = rundown.title.lowercase().replace(" ", "_")
                it[programStart] = System.currentTimeMillis()
            }
        }

        // Build the full schedule and persist via repository (handles rows + columns)
        val schedule = Schedule(
            id = rundownId,
            name = rundown.title,
            programStart = System.currentTimeMillis(),
            rows = rows,
            columns = columns,
        )

        ScheduleRepository.save(schedule)   // writes rows + columns + reloads store
        call.respond(HttpStatusCode.OK, schedule)
    }
}