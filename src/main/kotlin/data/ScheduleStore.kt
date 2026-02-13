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

    var rundownId = ConfigManager.loadOrCreate().rundownId

    fun loadInitial(): Schedule {
        return try {
            Schedule(
                programStart = nextFullSecond(),
                activeRowId = null,
                title = "Test Schedule",
                rows = loadColumnsFromRundown(rundownId)
            )
        } catch (e: Exception) {
            println("CSV load failed, using fallback: ${e.message}")
            Schedule(
                programStart = nextFullSecond(),
                activeRowId = null,
                title = "Test Schedule",
                rows = listOf(
                    Row(
                        activatedAt = 0,
                        id = 1,
                        page = "1",
                        cells = mapOf(
                            "kamera" to CellValue.Text("Profil - Lars"),
                            "gfx" to CellValue.Text("super = Lars Kristian Småge Syvertsen")
                        ),
                        title = "What",
                        duration = 15000L
                    )
                )
            )
        }
    }

    fun updateColumns() {
        val current = state.get()

        val newColumns = try {
            loadColumnsFromRundown(rundownId)
        } catch (e: Exception) {
            println("Column update failed: ${e.message}")
            return
        }

        val oldById = current.rows.associateBy { it.id }

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

        val updatedSchedule = current.copy(
            rows = merged,
        )

        state.set(updatedSchedule)
    }

    fun updateRows(newRows: List<Row>) {
        val current = state.get()

        val oldById = current.rows.associateBy { it.id }

        val merged = newRows.map { newRow ->
            val old = oldById[newRow.id]

            if (old == null) {
                newRow
            } else {
                newRow.copy(
                    activatedAt = old.activatedAt
                )
            }
        }

        val updatedSchedule = current.copy(
            rows = merged,
        )

        state.set(updatedSchedule)
    }
}
