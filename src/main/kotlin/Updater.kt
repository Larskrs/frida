import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.client.statement.bodyAsText
import kotlinx.serialization.json.*
import java.io.File
import java.time.Instant

object Updater {

    private const val OWNER = "Larskrs"
    private const val REPO = "frida"
    private const val API =
        "https://api.github.com/repos/$OWNER/$REPO/releases/latest"

    private val client = HttpClient()

    suspend fun check(): ReleaseInfo? {

        val response: String = client.get(API).bodyAsText()
        val json = Json.parseToJsonElement(response).jsonObject

        val publishedAt = json["published_at"]
            ?.jsonPrimitive?.content
            ?: return null

        val remoteInstant = Instant.parse(publishedAt)
        val localInstant = UpdateState.load()?.let { Instant.parse(it) }

        if (localInstant != null && !remoteInstant.isAfter(localInstant)) {
            return null
        }

        val version = json["name"]
            ?.jsonPrimitive
            ?.content
            ?: return null

        val asset = json["assets"]
            ?.jsonArray
            ?.firstOrNull()
            ?.jsonObject
            ?: return null

        val downloadUrl = asset["browser_download_url"]
            ?.jsonPrimitive
            ?.content
            ?: return null

        return ReleaseInfo(
            version = version,
            publishedAt = publishedAt,
            downloadUrl = downloadUrl
        )
    }
}

data class ReleaseInfo(
    val publishedAt: String,
    val downloadUrl: String,
    val version: String
)

object UpdateState {
    private val file = File("update.state")

    fun save(publishedAt: String) {
        file.writeText(publishedAt)
    }

    fun load(): String? {
        return if (file.exists()) file.readText() else null
    }
}