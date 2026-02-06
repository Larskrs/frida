package com.example

import com.example.data.resolveSchedule

fun main(args: Array<String>) {

    println("Booting application...")

    val isDev = System.getenv("DEV_MODE") == "true"

    val resolved = resolveSchedule(args)
    val scheduleFile = resolved.file
    val config = resolved.updatedConfig

    println("Schedule loaded: ${scheduleFile.name}")

    startServer(config.port, scheduleFile)
}
