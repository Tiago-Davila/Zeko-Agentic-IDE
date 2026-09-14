package com.zeko.coordination.application;

import java.util.List;

public interface ContextProvider {
  List<Context> context(String query);
  record Context(String sourceId, String level, String excerpt) {}
}
