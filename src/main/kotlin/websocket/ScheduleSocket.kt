package com.example.websocket

import data.CellValue
import data.Schedule
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
sealed class ScheduleEvent {

    @SerialName("com.example.websocket.ScheduleEvent.Load")
    @Serializable
    data class Load(
        val scheduleId: Int,
        val schedule: Schedule? = null,
        val error: String? = null,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.RequestLoad")
    @Serializable
    data class RequestLoad(val scheduleId: Int) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.ChangeSchedule")
    @Serializable
    data class ChangeSchedule(val rundownId: Int) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.ReloadSchedule")
    @Serializable
    data class ReloadSchedule(val scheduleId: Int) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.RowCreate")
    @Serializable
    data class RowCreate(
        val order: Int,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.RowDelete")
    @Serializable
    data class RowDelete(
        val rowId: Int,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.RowEdited")
    @Serializable
    data class RowEdited(
        val rowId: Int,
        val columnId: Int,
        val cell: CellValue,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.ColumnCreate")
    @Serializable
    data class ColumnCreate(
        val name: String?,
        val columnType: String?,
        val order: Int,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.ColumnEdited")
    @Serializable
    data class ColumnEdited(
        val columnId: Int,
        val columnType: String,
        val name: String,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.ColumnDelete")
    @Serializable
    data class ColumnDelete(
        val columnId: Int,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.ProgramStartChanged")
    @Serializable
    data class ProgramStartChanged(
        val programStart: Long,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.ActiveRowChanged")
    @Serializable
    data class ActiveRowChanged(
        val rowId: Int,
        var activatedAt: Long = 0,
    ) : ScheduleEvent()

    @SerialName("com.example.websocket.ScheduleEvent.StartProgramAtRow")
    @Serializable
    data class StartProgramAtRow(
        val rowId: Int,
    ) : ScheduleEvent()
}