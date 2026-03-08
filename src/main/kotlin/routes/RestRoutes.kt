
package com.example.routes


import com.example.data.DatabaseFactory
import com.example.data.RundownRoutes.getRundowns
import com.example.data.ScheduleRepository
import com.example.data.getDbStatus
import com.example.data.importRundownAsSchedule
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post

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

        val schedule = try {
            importRundownAsSchedule(rundownId, rundown.title)
        } catch (e: Exception) {
            return@post call.respond(HttpStatusCode.BadGateway, "Import failed: ${e.message}")
        }

        call.respond(HttpStatusCode.OK, schedule)
    }
}