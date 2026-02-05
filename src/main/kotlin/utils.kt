package com.example

import java.time.Instant

fun nextFullSecond(): Long {
    val now = Instant.now().toEpochMilli()
    val remainder = now % 1000
    return if (remainder == 0L) now else now + (1000 - remainder)
}
