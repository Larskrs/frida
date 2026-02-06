package com.example.data

import com.example.config.ConfigManager
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
            Schedule(
                programStart = nextFullSecond(),
                activeColumnId = null,
                columns = loadColumnsFromRundown(ConfigManager.loadOrCreate().rundownId)
            )
        } catch (e: Exception) {
            println("CSV load failed, using fallback: ${e.message}")
            fallbackSchedule()
        }
    }

    fun updateColumns() {
        val current = state.get()

        val newColumns = try {
            loadColumnsFromRundown(ConfigManager.loadOrCreate().rundownId)
        } catch (e: Exception) {
            println("Column update failed: ${e.message}")
            return
        }

        val oldById = current.columns.associateBy { it.id }

        val merged = newColumns.map { newCol ->
            val old = oldById[newCol.id]

            if (old == null) {
                // brand new column → use new as-is
                newCol
            } else {
                // merge: keep runtime state, replace content
                newCol.copy(
                    activatedAt = old.activatedAt
                    // add more runtime fields here if you have them
                )
            }
        }

        // keep schedule progress
        val updatedSchedule = current.copy(
            columns = merged,
            // programStart unchanged
            // activeColumnId unchanged
        )

        state.set(updatedSchedule)
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
