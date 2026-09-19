plugins {
    java
    checkstyle
    id("org.springframework.boot") version "3.5.16"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.zeko"
version = "0.1.0-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.flywaydb:flyway-core")
    implementation("org.xerial:sqlite-jdbc:3.49.1.0")
    implementation("org.apache.lucene:lucene-core:10.5.0")
    implementation("org.apache.lucene:lucene-analysis-common:10.5.0")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

checkstyle {
    toolVersion = "10.26.1"
    configFile = file("config/checkstyle/checkstyle.xml")
    isIgnoreFailures = false
    maxWarnings = 0
    maxErrors = 0
}

val integrationTestPattern = "*IntegrationTest"
val contractTestPattern = "*ContractTest"
val frontendDirectory = layout.projectDirectory.dir("../frontend")
val frontendDistribution = frontendDirectory.dir("dist")
val npmExecutable = if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
    "npm.cmd"
} else {
    "npm"
}

val installFrontend by tasks.registering(Exec::class) {
    workingDir(frontendDirectory)
    commandLine(npmExecutable, "ci")
    inputs.files(
        frontendDirectory.file("package.json"),
        frontendDirectory.file("package-lock.json"),
    )
    outputs.dir(frontendDirectory.dir("node_modules"))
}

val buildFrontend by tasks.registering(Exec::class) {
    dependsOn(installFrontend)
    workingDir(frontendDirectory)
    commandLine(npmExecutable, "run", "build")
    inputs.dir(frontendDirectory.dir("src"))
    inputs.files(
        frontendDirectory.file("index.html"),
        frontendDirectory.file("vite.config.ts"),
        frontendDirectory.file("tsconfig.json"),
    )
    outputs.dir(frontendDistribution)
}

tasks.named<Copy>("processResources") {
    dependsOn(buildFrontend)
    from(frontendDistribution) {
        into("static")
    }
}

// Las tres suites comparten src/test/java y se separan por convencion de nombre.
fun Test.useTestSourceSet() {
    val testSourceSet = sourceSets.getByName("test")
    testClassesDirs = testSourceSet.output.classesDirs
    classpath = testSourceSet.runtimeClasspath
    useJUnitPlatform()
    testLogging {
        events("failed", "skipped")
    }
}

tasks.named<Test>("test") {
    useTestSourceSet()
    filter {
        excludeTestsMatching(integrationTestPattern)
        excludeTestsMatching(contractTestPattern)
        isFailOnNoMatchingTests = false
    }
}

tasks.register<Test>("integrationTest") {
    description = "Runs the integration test suite."
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    useTestSourceSet()
    filter {
        includeTestsMatching(integrationTestPattern)
        isFailOnNoMatchingTests = false
    }
    shouldRunAfter(tasks.named("test"))
}

tasks.register<Test>("contractTest") {
    description = "Runs the contract test suite."
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    useTestSourceSet()
    filter {
        includeTestsMatching(contractTestPattern)
        isFailOnNoMatchingTests = false
    }
    shouldRunAfter(tasks.named("test"))
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.compilerArgs.add("-parameters")
}

tasks.named<Jar>("jar") {
    enabled = false
}
