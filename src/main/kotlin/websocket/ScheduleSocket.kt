package com.example.websocket

import kotlinx.serialization.Serializable
import com.example.data.*
import kotlinx.serialization.json.JsonElement

@Serializable
sealed class ScheduleEvent {

    @Serializable
    data class Load(
        val scheduleId: Int,
        val schedule: Schedule? = null,
        val error: String? = null
    ) : ScheduleEvent()

    @Serializable
    data class RequestLoad(val scheduleId: Int) : ScheduleEvent()

    @Serializable
    data class ChangeSchedule(val rundownId: Int) : ScheduleEvent()

    @Serializable
    data class ReloadSchedule(val scheduleId: Int) : ScheduleEvent()

    @Serializable
    data class RowEdited(
        val scheduleId: Int,
        val rowId: Int,
        val key: String,
        val value: JsonElement? = null,
        val cell: CellValue? = null
    ) : ScheduleEvent()


    @Serializable
    data class ProgramStartChanged(val scheduleId: Int, val programStart: Long) : ScheduleEvent()

    @Serializable
    data class ActiveRowChanged(
        val scheduleId: Int,
        val rowId: Int,
        var activatedAt: Long =0,
    ) : ScheduleEvent()

    @Serializable
    data class StartProgramAtRow(
        val scheduleId: Int,
        val rowId: Int,
    ) : ScheduleEvent()
}