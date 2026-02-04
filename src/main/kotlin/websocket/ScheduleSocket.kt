package com.example.websocket

import kotlinx.serialization.Serializable
import com.example.data.*

@Serializable
sealed class ScheduleEvent {

    @Serializable
    data class Load(val schedule: Schedule) : ScheduleEvent()

    @Serializable
    data class ColumnEdited(
        val columnId: String,
        val key: String,
        val value: CellValue
    ) : ScheduleEvent()

    @Serializable
    data class ActiveColumnChanged(
        val columnId: String
    ) : ScheduleEvent()
}