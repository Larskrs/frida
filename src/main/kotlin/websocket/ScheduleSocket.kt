package com.example.websocket

import kotlinx.serialization.Serializable
import com.example.data.*

@Serializable
sealed class ScheduleEvent {

    @Serializable
    data class Load(val schedule: Schedule) : ScheduleEvent()

    @Serializable
    data class ChangeSchedule(val rundownId: Int) : ScheduleEvent()

    @Serializable
    object ReloadSchedule : ScheduleEvent()

    @Serializable
    data class RowEdited(
        val rowId: String,
        val key: String,
        val value: CellValue
    ) : ScheduleEvent()

    @Serializable
    data class ProgramStartChanged(val programStart: Long) : ScheduleEvent()

    @Serializable
    data class ActiveRowChanged(
        val rowId: Int,
        var activatedAt: Long =0,
    ) : ScheduleEvent()

    @Serializable
    data class StartProgramAtRow(
        val rowId: Int,
    ) : ScheduleEvent()
}