package com.zeko.coordination.domain;

public enum InstructionPrecedence {
  DEFAULT,
  SKILL,
  AGENT,
  PROJECT_MANAGER,
  PROJECT_RULES,
  USER;

  public boolean overrides(InstructionPrecedence other) {
    return ordinal() > other.ordinal();
  }
}
