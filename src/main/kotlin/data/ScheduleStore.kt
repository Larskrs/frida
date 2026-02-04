package com.example.data

import java.time.Instant
import java.util.concurrent.atomic.AtomicReference

object ScheduleStore {

    private val state = AtomicReference(loadInitial())

    fun get(): Schedule = state.get()

    fun set(newState: Schedule) {
        state.set(newState)
    }

    fun loadInitial(): Schedule {
        return Schedule(
            columns = listOf(
                Column(
                    id = "A1",
                    title = "Vignett",
                    duration = 50000,
                    cells = mapOf(
                        "kamera" to CellValue.Text("Lars"),
                    )
                ),
                Column(
                    id = "A2",
                    title = "Manual",
                    duration = 240000,
                    cells = mapOf(
                        "kamera" to CellValue.Text("Profil - Lars"),
                        "gfx" to CellValue.Text("super = Lars Kristian Småge Syvertsen")
                    )
                ),
                Column(
                    id = "A3",
                    title = "Manual",
                    duration = 150000,
                    cells = mapOf(
                        "host" to CellValue.Text("Lars"),
                        "gfx" to CellValue.Text("super = Lars Kristian Småge Syvertsen")
                    )
                ),
                Column(
                    id = "A4",
                    title = "Manual",
                    duration = 50000,
                    cells = mapOf(
                        "host" to CellValue.Text("Lars"),
                        "gfx" to CellValue.Text("super = Lars Kristian Småge Syvertsen")
                    )
                )
            ),
            "1",
            programStart = Instant.now().toEpochMilli(),
        )
    }

    // later:
    fun loadFromDb() {}
    fun saveToDb() {}
}
