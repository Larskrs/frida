package com.example

import com.example.config.ConfigManager
import com.example.data.DatabaseFactory

val appStartTime = System.currentTimeMillis()

fun main(args: Array<String>) {


    println("Booting application...")

    DatabaseFactory.init()

    val isDev = System.getenv("DEV_MODE") == "true"
    println("Currently running in ${if (isDev) "development" else "production"}")

    val config = ConfigManager.loadOrCreate()

    startServer(config.port)
}

