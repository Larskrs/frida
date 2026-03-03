package com.example.websocket

import kotlinx.serialization.Serializable
import data.CellValue
import data.Schedule
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
    data class RowCreate(
        val scheduleId: Int,
        val order: Int,
    ): ScheduleEvent()

    @Serializable
    data class RowDelete(
        val scheduleId: Int,
        val rowId: Int,
    ): ScheduleEvent()

    @Serializable
    data class ColumnDelete(
        val scheduleId: Int,
        val columnId: Int,
    ): ScheduleEvent()

    @Serializable
    data class RowEdited(
        val scheduleId: Int,
        val rowId: Int,
        val key: String? = null,      // top-level field
        val columnId: Int? = null,    // DB column
        val value: JsonElement? = null,
        val cell: CellValue? = null
    ) : ScheduleEvent()

    @Serializable
    data class ColumnEdited(
        val scheduleId: Int,
        val columnId: Int,
        val columnType: String,
        val name: String,
    ): ScheduleEvent()

    @Serializable
    data class ColumnCreate(
        val scheduleId: Int,
        val name: String?,
        val columnType: String?,
        val order: Int,
    ): ScheduleEvent()

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