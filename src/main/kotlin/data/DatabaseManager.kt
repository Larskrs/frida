package com.example.data

import kotlinx.serialization.Serializable

import com.zaxxer.hikari.HikariDataSource
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.lang.management.ManagementFactory
import javax.sql.DataSource


@Serializable
data class DbStatus(
    val connected: Boolean,
    val databaseProduct: String?,
    val databaseVersion: String?,
    val jdbcUrl: String?,
    val activeConnections: Int?,
    val idleConnections: Int?,
    val totalConnections: Int?,
    val maxPoolSize: Int?,
    val schedulesCount: Int,
    val archivedSchedulesCount: Int,
    val rowsCount: Int,
    val serverTime: Long,
    val appUptimeMs: Long,
)

fun getDbStatus(dataSource: DataSource): DbStatus {

    var connected = false
    var product: String? = null
    var version: String? = null
    var jdbcUrl: String? = null

    var active: Int? = null
    var idle: Int? = null
    var total: Int? = null
    var max: Int? = null

    try {
        dataSource.connection.use { conn ->
            connected = true
            val meta = conn.metaData
            product = meta.databaseProductName
            version = meta.databaseProductVersion
            jdbcUrl = meta.url
        }

        if (dataSource is HikariDataSource) {
            val mx = dataSource.hikariPoolMXBean
            active = mx.activeConnections
            idle = mx.idleConnections
            total = mx.totalConnections
            max = dataSource.maximumPoolSize
        }

    } catch (_: Exception) {
        connected = false
    }

    val (schedules, rows) = try {
        transaction {
            Pair(
                SchedulesTable.selectAll().count().toInt(),
                RowsTable.selectAll().count().toInt()
            )
        }
    } catch (_: Exception) {
        Pair(0, 0)
    }

    val uptime = ManagementFactory.getRuntimeMXBean().uptime

    return DbStatus(
        connected = connected,
        databaseProduct = product,
        databaseVersion = version,
        jdbcUrl = jdbcUrl,

        activeConnections = active,
        idleConnections = idle,
        totalConnections = total,
        maxPoolSize = max,

        schedulesCount = schedules,
        archivedSchedulesCount = 0,
        rowsCount = rows,

        serverTime = System.currentTimeMillis(),
        appUptimeMs = uptime,
    )
}


