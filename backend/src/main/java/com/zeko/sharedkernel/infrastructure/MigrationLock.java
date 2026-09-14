package com.zeko.sharedkernel.infrastructure;

import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

public final class MigrationLock {

    private static final Duration RETRY_INTERVAL = Duration.ofMillis(50);

    private final Path lockFile;
    private final Duration timeout;
    private final ReentrantLock inProcessLock = new ReentrantLock();

    public MigrationLock(Path lockFile, Duration timeout) {
        this.lockFile = lockFile.toAbsolutePath().normalize();
        this.timeout = timeout;
    }

    public void runExclusively(Runnable migration) {
        acquireInProcessLock();

        try {
            runWithFileLock(migration);
        } finally {
            inProcessLock.unlock();
        }
    }

    public Path lockFile() {
        return lockFile;
    }

    private void acquireInProcessLock() {
        boolean acquired;
        try {
            acquired = inProcessLock.tryLock(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw DomainError.conflict("La espera por la migracion local fue interrumpida");
        }

        if (!acquired) {
            throw DomainError.conflict("Otra migracion local sigue en curso tras " + timeout);
        }
    }

    private void runWithFileLock(Runnable migration) {
        createLockFileDirectory();

        try (FileChannel channel = FileChannel.open(lockFile, StandardOpenOption.WRITE, StandardOpenOption.CREATE)) {
            FileLock fileLock = acquire(channel);
            try {
                migration.run();
            } finally {
                fileLock.release();
            }
        } catch (IOException failure) {
            throw DomainError.conflict("No se pudo tomar el lock de migracion local: " + failure.getMessage());
        }
    }

    private FileLock acquire(FileChannel channel) throws IOException {
        long deadline = System.nanoTime() + timeout.toNanos();

        while (true) {
            FileLock candidate = tryLock(channel);
            if (candidate != null) {
                return candidate;
            }

            if (System.nanoTime() >= deadline) {
                throw DomainError.conflict("Otro proceso local mantiene el lock de migracion tras " + timeout);
            }

            sleepBeforeRetry();
        }
    }

    // Otro titular del lock, dentro o fuera de esta JVM, se trata igual: hay que reintentar.
    private FileLock tryLock(FileChannel channel) throws IOException {
        try {
            return channel.tryLock();
        } catch (OverlappingFileLockException alreadyHeldInThisJvm) {
            return null;
        }
    }

    private void sleepBeforeRetry() {
        try {
            Thread.sleep(RETRY_INTERVAL.toMillis());
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw DomainError.conflict("La espera por el lock de migracion local fue interrumpida");
        }
    }

    private void createLockFileDirectory() {
        Path parent = lockFile.getParent();
        if (parent == null) {
            return;
        }

        try {
            Files.createDirectories(parent);
        } catch (IOException failure) {
            throw DomainError.conflict("No se pudo preparar el lock de migracion local: " + failure.getMessage());
        }
    }
}
