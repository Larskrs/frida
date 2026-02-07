package com.example.websocket

import com.example.config.ConfigManager
import com.example.data.ScheduleStore
import com.example.nextFullSecond
import kotlinx.coroutines.*
import java.time.Instant
import kotlin.math.max

object ScheduleTicker {

    private var job: Job? = null
    private var config = ConfigManager.loadOrCreate()

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

        if (!config.autoScrollerDefault) {
            return
        }

        val now = Instant.now().toEpochMilli()
        val programStart = schedule.programStart ?: return

        // ---------- PRE-START ACTIVATION ----------
        if (now >= programStart && schedule.activeRowId == null) {
            val firstRow = schedule.rows.firstOrNull() ?: return

            val newTime = alignedNow(programStart)

            val newRows = schedule.rows.map { col ->
                if (col.id == firstRow.id)
                    col.copy(activatedAt = newTime)
                else
                    col
            }

            schedule = schedule.copy(
                activeRowId = firstRow.id,
                rows = newRows
            )

            ScheduleStore.set(schedule)

            broadcast(
                ScheduleEvent.ActiveRowChanged(
                    rowId = firstRow.id,
                    activatedAt = newTime
                )
            )

            return // important — don't fall through
        }

        // ---------- NORMAL FLOW ----------
        if (programStart > now) return

        var activeId = schedule.activeRowId ?: return
        var activeIndex = schedule.rows.indexOfFirst { it.id == activeId }
        if (activeIndex == -1) return

        // LOOP instead of single step
        while (true) {
            val activeCol = schedule.rows[activeIndex]
            val activatedAt = activeCol.activatedAt ?: return
            val duration = activeCol.duration ?: return

            val elapsed = now - activatedAt

            // Not finished → stop loop
            if (elapsed < duration) return

            val nextIndex = activeIndex + 1
            if (nextIndex >= schedule.rows.size) return

            val nextCol = schedule.rows[nextIndex]

            val newTime = alignedNow(schedule.programStart)

            val newColumns = schedule.rows.map { col ->
                if (col.id == nextCol.id)
                    col.copy(activatedAt = newTime)
                else
                    col
            }

            schedule = schedule.copy(
                activeRowId = nextCol.id,
                rows = newColumns
            )

            ScheduleStore.set(schedule)

            broadcast(
                ScheduleEvent.ActiveRowChanged(
                    rowId = nextCol.id,
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
