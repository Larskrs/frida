package com.example

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.*
import kotlinx.serialization.encoding.*

object BooleanIntSerializer : KSerializer<Boolean> {

    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("BooleanInt", PrimitiveKind.INT)

    override fun serialize(encoder: Encoder, value: Boolean) {
        encoder.encodeInt(if (value) 1 else 0)
    }

    override fun deserialize(decoder: Decoder): Boolean {
        return when (val v = decoder.decodeInt()) {
            1 -> true
            0 -> false
            else -> throw IllegalArgumentException("Invalid boolean int: $v")
        }
    }
}
