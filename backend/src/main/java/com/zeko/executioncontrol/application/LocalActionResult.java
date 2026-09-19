package com.zeko.executioncontrol.application;

import java.util.List;

public record LocalActionResult(Status status, String knownState,
                                List<String> effects, String safeOutput) {
  public enum Status { COMPLETED, RUNNING, CANCELLED, FAILED, UNAVAILABLE }
  public LocalActionResult {
    effects = effects == null ? List.of() : List.copyOf(effects);
    knownState = knownState == null ? "UNKNOWN" : knownState.trim();
    safeOutput = redact(safeOutput);
  }
  public static LocalActionResult unavailable(String detail) {
    return new LocalActionResult(Status.UNAVAILABLE, "UNAVAILABLE", List.of(),
                                 detail);
  }
  private static String redact(String value) {
    if (value == null) {
      return "";
    }
    return value.replaceAll("(?i)(token|password|secret|authorization)=[^\\s]+",
                            "$1=[REDACTED]");
  }
}
