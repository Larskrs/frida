package com.example

import java.time.Instant

fun nextFullSecond(): Long {
    val now = Instant.now().toEpochMilli()
    val remainder = now % 1000
    return if (remainder == 0L) now else now + (1000 - remainder)
}

fun escape(valueRaw: String): String {
    var v = valueRaw

    // ---- NORMALIZE LINE BREAKS ----
    v = v.replace("\r\n", "\n")
        .replace("\r", "\n")

    // ---- REMOVE NULL + CONTROL CHARS ----
    v = v.filter { it >= ' ' || it == '\n' }

    // ---- TRIM EXCESS ----
    v = v.trim()

    // ---- CHECK IF QUOTES NEEDED ----
    val needsQuotes =
        v.contains(',') ||
                v.contains('"') ||
                v.contains('\n')

    if (!needsQuotes) return v

    // ---- ESCAPE QUOTES ----
    v = v.replace("\"", "\"\"")

    return "\"$v\""
}