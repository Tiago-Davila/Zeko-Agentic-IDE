plugins {
    java
    checkstyle
    `jvm-test-suite`
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
}

checkstyle {
    toolVersion = "10.26.1"
    configFile = file("config/checkstyle/checkstyle.xml")
    isIgnoreFailures = false
    maxWarnings = 0
    maxErrors = 0
}

testing {
    suites {
        named<JvmTestSuite>("test") {
            useJUnitJupiter()
            dependencies {
                implementation("org.springframework.boot:spring-boot-starter-test")
            }
        }

        register<JvmTestSuite>("integrationTest") {
            useJUnitJupiter()
            dependencies {
                implementation(project())
                implementation("org.springframework.boot:spring-boot-starter-test")
            }
        }

        register<JvmTestSuite>("contractTest") {
            useJUnitJupiter()
            dependencies {
                implementation(project())
                implementation("org.springframework.boot:spring-boot-starter-test")
            }
        }
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.compilerArgs.add("-parameters")
}

tasks.withType<Test>().configureEach {
    testLogging {
        events("failed", "skipped")
    }
}

tasks.named<Jar>("jar") {
    enabled = false
}
