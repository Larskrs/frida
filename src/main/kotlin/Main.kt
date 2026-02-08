package com.example

import com.example.config.ConfigManager

fun main(args: Array<String>) {

    println("Booting application...")

    val isDev = System.getenv("DEV_MODE") == "true"
    println("Currently running in ${if (isDev) "development" else "production"}")

    val config = ConfigManager.loadOrCreate()

    startServer(config.port)
}

