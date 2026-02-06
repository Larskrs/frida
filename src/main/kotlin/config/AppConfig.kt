package com.example.config

import kotlinx.serialization.Serializable

@Serializable
data class AppConfig(
    val schedule: String = "default.csv",
    val port: Int = 80
)
