package data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Duration
import java.time.Instant

@Serializable
data class Schedule(
    val id: Int,
    val rows: List<Row>,
    val columns: List<Column>,
    var activeRowId: Int? = null,
    var isArchived: Boolean = false,
    val name: String,
    var programStart: Long,
)

@Serializable
data class Row(
    val id: Int,
    val order: Int,
    val cells: Map<Int, CellValue>,
    var activatedAt: Long = 0,
)

@Serializable
data class Column(
    val id: Int,
    val name: String,
    val type: String,
    val order: Int,
    val system: Boolean = false,
    val hidden: Boolean
)

// ---- Cell helpers ----

fun Row.durationMs(schedule: Schedule): Long {
    val durationCol = schedule.columns.firstOrNull { it.system && it.name == "duration" } ?: return 0L
    return (cells[durationCol.id] as? CellValue.Number)?.value?.toLong() ?: 0L
}

fun Row.absoluteStart(schedule: Schedule): Instant {
    val start = Instant.ofEpochMilli(schedule.programStart)
    var sum = 0L
    for (row in schedule.rows) {
        if (row.id == this.id) break
        sum += row.durationMs(schedule)
    }
    return start.plusMillis(sum)
}

fun Row.timeUntilStart(schedule: Schedule): Duration {
    val now = Instant.now()
    return Duration.between(now, absoluteStart(schedule))
}

// ---- System column keys ----

object SystemColumns {
    const val TITLE    = "title"
    const val PAGE     = "page"
    const val SCRIPT   = "script"
    const val DURATION = "duration"

    val ALL = listOf(TITLE, PAGE, SCRIPT, DURATION)
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
    @Serializable data class Time(val millis: Long) : CellValue()
}