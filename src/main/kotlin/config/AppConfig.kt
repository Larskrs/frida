package com.example.config

import kotlinx.serialization.Serializable

@Serializable
data class AppConfig(
    val port: Int = 80,
    val rundownUrl: String = "rundown_url",
    val rundownKey: String = "rundown_key",
    val rundownToken: String = "rundown_token",
    val rundownId: Int = 0,
    val autoScrollerDefault: Boolean = true,
)
