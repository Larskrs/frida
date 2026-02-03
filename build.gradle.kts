plugins {
    java
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ktor)
    kotlin("plugin.serialization") version "1.9.22"
    id("com.gradleup.shadow") version "9.0.0"
}

group = "com.example"
version = "0.0.1"

val ktor_version = "2.3.9"

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

kotlin {
    jvmToolchain(21)
}
repositories {
    mavenCentral()
}

dependencies {
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)
    implementation("io.ktor:ktor-server-websockets:${ktor_version}")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktor_version")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation(libs.logback.classic)
    implementation(libs.ktor.server.config.yaml)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}

tasks.register<Exec>("buildExe") {
    dependsOn(tasks.shadowJar)

    val jar = tasks.shadowJar.get().archiveFile.get().asFile
    val outputDir = layout.buildDirectory.dir("exe").get().asFile

    doFirst {
        outputDir.mkdirs()
    }

    commandLine(
        "jpackage",
        "--input", jar.parent,
        "--name", "MyServer",
        "--main-jar", jar.name,
        "--type", "exe",
        "--dest", outputDir,
        "--java-options", "-Xmx512m"
    )
}