package com.example.data

import com.example.config.AppConfig
import com.example.config.ConfigManager
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import data.CellValue
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.transactions.transaction

object DatabaseFactory {

    private val config: AppConfig = ConfigManager.loadOrCreate()

    val hikariSource: HikariDataSource by lazy {
        getHikariDataSource()
    }

    lateinit var database: Database

    private fun getHikariDataSource(): HikariDataSource {
        return HikariDataSource(getHikariConfig())
    }

    private fun getHikariConfig(): HikariConfig {

        println("Postgres Settings loaded from config")
        println("    - URL: ${config.databaseURL}")
        println("    - User: ${config.databaseUser}")
        println("    - Password: ********") // never print real password

        return HikariConfig().apply {
            jdbcUrl = config.databaseURL
            driverClassName = "org.postgresql.Driver"
            username = config.databaseUser
            password = config.databasePassword

            maximumPoolSize = 10
            minimumIdle = 1
            connectionTimeout = 5000
            idleTimeout = 60000
            maxLifetime = 1800000
            leakDetectionThreshold = 10000

            isAutoCommit = false
            transactionIsolation = "TRANSACTION_REPEATABLE_READ"

            validate()
        }
    }

    fun init() {
        println("Initializing Database from PostgreSQL")

        database = Database.connect(hikariSource)

        transaction(database) {
            SchemaUtils.create(SchedulesTable, RowsTable, ColumnsTable)
            SchemaUtils.addMissingColumnsStatements(SchedulesTable, RowsTable, ColumnsTable)
        }
    }
}

object SchedulesTable : IntIdTable("schedules") {
    val name = varchar("name", 255)
    val slug = varchar("slug", 255)
    val programStart = long("program_start")
    val isArchived = bool("is_archived").default(false)
}

object RowsTable : Table("rows") {
    val id = integer("id").autoIncrement()
    val order = integer("order")
    val scheduleId = reference("schedule_id", SchedulesTable)
    val page = varchar("page", 50)
    val title = varchar("title", 255)
    val duration = long("duration")
    val script = text("script")

    val cells = jsonb<Map<Int, CellValue>>(
        "cells",
        kotlinx.serialization.json.Json
    )

    override val primaryKey = PrimaryKey(id, scheduleId)
}

object ColumnsTable : Table("columns") {
    val id = integer("id").autoIncrement()
    val name = varchar("name", 255)
    val order = integer("order")
    val type = varchar("type", 255)
    val scheduleId = reference("schedule_id", SchedulesTable)

    override val primaryKey = PrimaryKey(id, scheduleId)
}