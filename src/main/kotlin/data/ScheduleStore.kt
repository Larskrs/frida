package com.example.data

import com.example.nextFullSecond
import java.time.Instant
import java.util.concurrent.atomic.AtomicReference

object ScheduleStore {

    private val state = AtomicReference(loadInitial())

    fun get(): Schedule = state.get()

    fun set(newState: Schedule) {
        state.set(newState)
    }

    fun loadInitial(): Schedule {
        return try {
            ScheduleCsvLoader.loadFromResources("schedule.csv")
        } catch (e: Exception) {
            println("CSV load failed, using fallback: ${e.message}")
            fallbackSchedule()
        }
    }


    fun fallbackSchedule(): Schedule {
        return Schedule(
            columns = listOf(
                Column(
                    id = "A1",
                    title = "Vignett",
                    duration = 5000,
                    cells = mapOf(
                        "kamera" to CellValue.Text("Lars"),
                    )
                ),
                Column(
                    id = "A2",
                    title = "Feature - EM i Skiskyting",
                    duration = 15000,
                    cells = mapOf(
                        "kamera" to CellValue.Text("Profil - Lars"),
                        "gfx" to CellValue.Text("super = Lars Kristian Småge Syvertsen")
                    )
                ),
                Column(
                    id = "A22",
                    title = "Feature - Mangel på barnehageplass",
                    duration = 15000,
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
            programStart = nextFullSecond(),
        )
    }

    // later:
    fun loadFromDb() {}
    fun saveToDb() {}
}
