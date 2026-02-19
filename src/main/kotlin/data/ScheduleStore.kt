package com.example.data

import com.example.nextFullSecond
import java.util.concurrent.ConcurrentHashMap

object ScheduleStore {

    private val schedules = ConcurrentHashMap<Int, Schedule>()

    init {
        ScheduleRepository.getAll().forEach {
            schedules[it.id] = it
        }
    }

    fun get(id: Int): Schedule? = schedules[id]

    fun getAll(): List<Schedule> = schedules.values.toList()

    fun reload (schedule: Schedule) {
        schedules[schedule.id] = schedule
        println("Updated schedule ${schedule.id}")
    }

    fun create(id: Int, title: String): Schedule {
        val schedule = Schedule(
            rows = emptyList(),
            name = title,
            id = id,
            programStart = nextFullSecond()
        )
        schedules[id] = schedule
        return schedule
    }

    fun delete(id: Int) {
        schedules.remove(id)
    }

    fun set(id: Int, newState: Schedule) {
        schedules[id] = newState
    }

    fun addRow(scheduleId: Int, row: Row) {
        val schedule = schedules[scheduleId] ?: return
        val updated = schedule.copy(rows = schedule.rows + row)
        schedules[scheduleId] = updated
    }

    fun removeRow(scheduleId: Int, rowId: Int) {
        val schedule = schedules[scheduleId] ?: return
        val updated = schedule.copy(
            rows = schedule.rows.filterNot { it.id == rowId }
        )
        schedules[scheduleId] = updated
    }

    fun updateRow(scheduleId: Int, newRow: Row) {
        val schedule = schedules[scheduleId] ?: return
        val updated = schedule.copy(
            rows = schedule.rows.map {
                if (it.id == newRow.id) newRow else it
            }
        )
        schedules[scheduleId] = updated
    }

    fun reorderRow(scheduleId: Int, rowId: Int, newIndex: Int) {
        val schedule = schedules[scheduleId] ?: return
        val rows = schedule.rows.toMutableList()

        val currentIndex = rows.indexOfFirst { it.id == rowId }
        if (currentIndex == -1) return

        val row = rows.removeAt(currentIndex)
        rows.add(newIndex.coerceIn(0, rows.size), row)

        schedules[scheduleId] = schedule.copy(rows = rows)
    }

    fun setActiveRow(scheduleId: Int, rowId: Int?) {
        val schedule = schedules[scheduleId] ?: return
        schedules[scheduleId] = schedule.copy(activeRowId = rowId)
    }

    fun setProgramStart(scheduleId: Int, startMs: Long) {
        val schedule = schedules[scheduleId] ?: return
        schedules[scheduleId] = schedule.copy(programStart = startMs)
    }

}
