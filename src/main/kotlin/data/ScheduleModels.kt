package com.example.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Duration
import java.time.Instant

@Serializable
data class Schedule(
    val columns: List<Column>,
    var activeColumnId: String? = null,
    var programStart: Long,
)

@Serializable
data class Column(
    val id: String,
    val title: String,
    val duration: Long,
    val cells: Map<String, CellValue>,

    var activatedAt: Long = 0,
)
fun Column.absoluteStart(schedule: Schedule): Instant {
    val start = Instant.ofEpochMilli(schedule.programStart)

    var sum = 0L
    for (col in schedule.columns) {
        if (col.id == this.id) break
        sum += col.duration
    }

    return start.plusMillis(sum)
}

fun Column.timeUntilStart(schedule: Schedule): Duration {
    val now = Instant.now()
    return Duration.between(now, absoluteStart(schedule))
}

@Serializable
sealed class CellValue {
    @Serializable data class Text(val value: String) : CellValue()
    @Serializable data class Number(val value: Double) : CellValue()
    @Serializable data class Bool(val value: Boolean) : CellValue()
    @Serializable data class StringList(val value: List<String>) : CellValue()
    @Serializable data class EnumVal(val value: String) : CellValue()
    @Serializable
    @SerialName("Time")
    data class Time(val millis: Long) : CellValue()
}
