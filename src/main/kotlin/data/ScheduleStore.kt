package com.example.data

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
                    id = "1",
                    title = "Vignett",
                    cells = mapOf(
                        "lengde" to CellValue.Number(30.0),
                        "kamera" to CellValue.Text("Lars"),
                    )
                ),
                Column(
                    id = "2",
                    title = "Manual",
                    cells = mapOf(
                        "duration" to CellValue.Number(30.0),
                        "kamera" to CellValue.Text("Profil - Lars"),
                        "gfx" to CellValue.Text("super = Lars Kristian Småge Syvertsen")
                    )
                ),
                Column(
                    id = "3",
                    title = "Manual",
                    cells = mapOf(
                        "duration" to CellValue.Number(30.0),
                        "host" to CellValue.Text("Lars"),
                        "gfx" to CellValue.Text("super = Lars Kristian Småge Syvertsen")
                    )
                )
            ),
            "1"
        )
    }

    // later:
    fun loadFromDb() {}
    fun saveToDb() {}
}
