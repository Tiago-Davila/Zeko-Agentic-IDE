package com.zeko.memorysearch.application;

import java.nio.file.Path;

public interface SourceReader {
  String read(Path root, Path source);
}
