package com.example.websocket

import com.example.data.ScheduleStore
import com.example.nextFullSecond
import kotlinx.coroutines.*
import java.time.Instant
import kotlin.math.max

object ScheduleTicker {

    private var job: Job? = null

    fun start(scope: CoroutineScope) {
        if (job != null) return // prevent duplicates

        job = scope.launch {
            while (isActive) {

                val schedule = ScheduleStore.get()
                val programStart = schedule.programStart

                // ---- ALIGN DELAY ----
                val delayMs = if (programStart != null) {
                    val now = nextFullSecond()
                    val startMs = programStart
                    val offset = (now - startMs) % 1000
                    max(1, 1000 - offset) // avoid 0
                } else {
                    1000L // fallback if no programStart
                }

                tick()
                delay(delayMs)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private suspend fun tick() {
        var schedule = ScheduleStore.get()
        if (schedule.programStart > Instant.now().toEpochMilli()) return

        var activeId = schedule.activeColumnId ?: return
        var activeIndex = schedule.columns.indexOfFirst { it.id == activeId }
        if (activeIndex == -1) return

        val now = Instant.now().toEpochMilli()

        // LOOP instead of single step
        while (true) {
            val activeCol = schedule.columns[activeIndex]
            val activatedAt = activeCol.activatedAt ?: return
            val duration = activeCol.duration ?: return

            val elapsed = now - activatedAt

            // Not finished → stop loop
            if (elapsed < duration) return

            val nextIndex = activeIndex + 1
            if (nextIndex >= schedule.columns.size) return

            val nextCol = schedule.columns[nextIndex]

            val newTime = alignedNow(schedule.programStart)

            val newColumns = schedule.columns.map { col ->
                if (col.id == nextCol.id)
                    col.copy(activatedAt = newTime)
                else
                    col
            }

            schedule = schedule.copy(
                activeColumnId = nextCol.id,
                columns = newColumns
            )

            ScheduleStore.set(schedule)

            broadcast(
                ScheduleEvent.ActiveColumnChanged(
                    columnId = nextCol.id,
                    activatedAt = newTime
                )
            )

            // PREPARE NEXT ITERATION
            activeIndex = nextIndex
            activeId = nextCol.id

            // 🚨 BREAK if next column has real duration
            val nextDuration = nextCol.duration ?: 0
            if (nextDuration > 0) return
            // else → continue loop instantly
        }
    }

}

private fun alignedNow(programStart: Long): Long {
    val now = Instant.now().toEpochMilli()
    val sinceStart = now - programStart
    val seconds = sinceStart / 1000
    return programStart + (seconds * 1000)
}
