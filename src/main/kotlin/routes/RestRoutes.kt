package com.example.routes

import com.example.data.RundownRoutes.getRundowns
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

fun Route.restRoutes() {

    get("/api/rundowns") {
        call.respond(
            getRundowns()
        )
    }

}