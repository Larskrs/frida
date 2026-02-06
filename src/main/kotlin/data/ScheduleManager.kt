package com.example.data

import com.example.config.AppConfig
import com.example.config.ConfigManager
import java.io.File

object ScheduleManager {

    val schedulesDir = File(ConfigManager.workDir, "schedules").apply {
        if (!exists()) mkdirs()
    }

    fun listSchedules(): List<File> =
        schedulesDir.listFiles { f -> f.extension.lowercase() == "csv" }
            ?.sortedBy { it.name }
            ?: emptyList()

    fun get(name: String): File =
        File(schedulesDir, name)
}

fun interactivePick(files: List<File>): File {
    if (files.isEmpty()) {
        error("No schedules found in /schedules folder")
    }

    println("Select a schedule:")
    files.forEachIndexed { i, f ->
        println("${i + 1}. ${f.name}")
    }

    while (true) {
        print("> ")
        val input = readlnOrNull()?.toIntOrNull()
        if (input != null && input in 1..files.size) {
            return files[input - 1]
        }
        println("Invalid selection.")
    }
}

data class ResolvedSchedule(
    val file: File,
    val updatedConfig: AppConfig
)

fun resolveSchedule(args: Array<String>): ResolvedSchedule {

    var config = ConfigManager.loadOrCreate()
    val schedules = ScheduleManager.listSchedules()

    // 1. CLI ARG
    if (args.isNotEmpty()) {
        val cliFile = ScheduleManager.get(args[0])
        if (cliFile.exists()) {
            println("Using CLI schedule: ${cliFile.name}")
            config = config.copy(schedule = cliFile.name)
            ConfigManager.save(config)
            return ResolvedSchedule(cliFile, config)
        }
        println("CLI schedule not found, falling back...")
    }

    // 2. CONFIG
    val configFile = ScheduleManager.get(config.schedule)
    if (configFile.exists()) {
        println("Using config schedule: ${configFile.name}")
        return ResolvedSchedule(configFile, config)
    }

    // 3. INTERACTIVE
    val picked = interactivePick(schedules)
    config = config.copy(schedule = picked.name)
    ConfigManager.save(config)

    return ResolvedSchedule(picked, config)
}
