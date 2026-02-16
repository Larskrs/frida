package com.example.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Duration
import java.time.Instant

@Serializable
data class Schedule(
    val id: Int,
    val rows: List<Row>,
    var activeRowId: Int? = null,
    var isArchived: Boolean = false,
    val name: String,
    var programStart: Long,
)

@Serializable
data class Row(
    val id: Int,
    val order: Int,
    val page: String,
    val title: String,
    val duration: Long,
    val cells: Map<String, CellValue>,
    var activatedAt: Long = 0,
    val script: String = ""
)
fun Row.absoluteStart(schedule: Schedule): Instant {
    val start = Instant.ofEpochMilli(schedule.programStart)

    var sum = 0L
    for (col in schedule.rows) {
        if (col.id == this.id) break
        sum += col.duration
    }

    return start.plusMillis(sum)
}

fun Row.timeUntilStart(schedule: Schedule): Duration {
    val now = Instant.now()
    return Duration.between(now, absoluteStart(schedule))
}

@Serializable
sealed class CellValue {
    @SerialName("Text")
    @Serializable data class Text(val value: String) : CellValue()

    @SerialName("Number")
    @Serializable data class Number(val value: Double) : CellValue()

    @SerialName("Boolean")
    @Serializable data class Bool(val value: Boolean) : CellValue()

    @SerialName("StringList")
    @Serializable data class StringList(val value: List<String>) : CellValue()

    @SerialName("Enum")
    @Serializable data class EnumVal(val value: String) : CellValue()

    @SerialName("Time")
    data class Time(val millis: Long) : CellValue()
}
