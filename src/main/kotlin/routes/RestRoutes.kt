
package com.example.routes

import com.example.data.DatabaseFactory
import com.example.data.RundownRoutes.getRundowns
import com.example.data.ScheduleRepository
import com.example.data.ScheduleStore
import com.example.data.getDbStatus
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

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
}