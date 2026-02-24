package com.example

import com.example.config.ConfigManager
import com.example.data.DatabaseFactory

object AppInfo {
    val version: String = object {}.javaClass
        .`package`
        .implementationVersion ?: "dev"
    val startedAt: Long = System.currentTimeMillis()
}

val appStartTime = System.currentTimeMillis()

suspend fun main(args: Array<String>) {

    println("Booting application...")
    println("${Ansi.CYAN}FRIDA [${AppInfo.version}]${Ansi.RESET}")

//    val releaseInfo = Updater.check()
    println("Current version: ${AppInfo.version}")
//    println("Latest version: ${releaseInfo?.version}")

    DatabaseFactory.init()

    val isDev = System.getenv("DEV_MODE") == "true"
    println("Currently running in ${if (isDev) "development" else "production"}")

    val config = ConfigManager.loadOrCreate()

    startServer(config.port)
}

