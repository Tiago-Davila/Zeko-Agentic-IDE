package com.zeko.executioncontrol.application;

public interface LocalModelPort {
  Generation generate(String model, String prompt);
  record Generation(Status status, String text, String detail) {
    public enum Status { COMPLETED, STREAMING, FAILED, UNAVAILABLE }
  }
}
