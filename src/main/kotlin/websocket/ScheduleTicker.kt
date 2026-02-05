package com.example.websocket

import com.example.data.ScheduleStore
import kotlinx.coroutines.*
import java.time.Instant

object ScheduleTicker {

    private var job: Job? = null

    fun start(scope: CoroutineScope) {
        if (job != null) return // prevent duplicates

        job = scope.launch {
            while (isActive) {
                tick()
                delay(250) // 4x per second is smooth enough
            }
        }
    }

    private suspend fun tick() {
        val schedule = ScheduleStore.get()
        val activeId = schedule.activeColumnId ?: return

        val activeIndex = schedule.columns.indexOfFirst { it.id == activeId }
        if (activeIndex == -1) return

        val activeCol = schedule.columns[activeIndex]
        val activatedAt = activeCol.activatedAt ?: return
        val duration = activeCol.duration ?: return

        val now = Instant.now().toEpochMilli()
        val elapsed = now - activatedAt

        if (elapsed >= duration) {
            val nextIndex = activeIndex + 1
            if (nextIndex >= schedule.columns.size) return

            val nextCol = schedule.columns[nextIndex]
            val newTime = Instant.now().toEpochMilli()

            val newColumns = schedule.columns.map { col ->
                if (col.id == nextCol.id)
                    col.copy(activatedAt = newTime)
                else
                    col
            }

            val updated = schedule.copy(
                activeColumnId = nextCol.id,
                columns = newColumns
            )

            ScheduleStore.set(updated)

            broadcast(
                ScheduleEvent.ActiveColumnChanged(
                    columnId = nextCol.id,
                    activatedAt = newTime
                )
            )
        }
    }
}
