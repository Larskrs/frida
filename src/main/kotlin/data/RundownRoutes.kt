package com.example.data

import com.example.BooleanIntSerializer
import com.example.config.ConfigManager
import com.example.websocket.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

@Serializable
data class GetRundownsType(

    @SerialName("RundownID")
    val rundownId: Int,

    @SerialName("Title")
    val title: String,

    @SerialName("FolderID")
    val folderId: Int,

    @SerialName("DefaultLayoutID")
    val defaultLayoutId: Int,

    @SerialName("Start")
    val start: Long,

    @SerialName("End")
    val end: Long,

    @SerialName("TotalRunningTime")
    val totalRunningTime: Long,

    @SerialName("Archived")
    @Serializable(with = BooleanIntSerializer::class)
    val archived: Boolean,

    @SerialName("Locked")
    @Serializable(with = BooleanIntSerializer::class)
    val locked: Boolean,

    @SerialName("Frozen")
    @Serializable(with = BooleanIntSerializer::class)
    val frozen: Boolean,

    @SerialName("Template")
    @Serializable(with = BooleanIntSerializer::class)
    val template: Boolean,

    @SerialName("Deleted")
    @Serializable(with = BooleanIntSerializer::class)
    val deleted: Boolean,
)


object RundownRoutes {

    var config = ConfigManager.loadOrCreate()

    fun getRundowns (): List<GetRundownsType> {
        val url = config.rundownUrl +
                "?APIKey=${config.rundownKey}" +
                "&APIToken=${config.rundownToken}" +
                "&Action=getRundowns" +
                "&Archived=false" +
                "Descending=false"

        val req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .GET()
            .build()

        val http = HttpClient.newHttpClient()

        val resp = http.send(req, HttpResponse.BodyHandlers.ofString())

        if (resp.statusCode() !in 200..299) {
            println("API failed: ${resp.statusCode()}")
            return listOf()
        }

        val rundowns: List<GetRundownsType> =
            json.decodeFromString(resp.body())

        return rundowns
    }

}