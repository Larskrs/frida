package com.example.data

import kotlinx.serialization.Serializable

@Serializable
data class Schedule(
    val columns: List<Column>,
    var activeColumnId: String? = null
)

@Serializable
data class Column(
    val id: String,
    val title: String,
    val cells: Map<String, CellValue>
)

@Serializable
sealed class CellValue {
    @Serializable data class Text(val value: String) : CellValue()
    @Serializable data class Number(val value: Double) : CellValue()
    @Serializable data class Bool(val value: Boolean) : CellValue()
    @Serializable data class StringList(val value: List<String>) : CellValue()
    @Serializable data class EnumVal(val value: String) : CellValue()
}
