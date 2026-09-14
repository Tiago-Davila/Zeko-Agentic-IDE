package com.zeko.memorysearch.infrastructure;

import com.zeko.coordination.application.ContextProvider;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CoordinationContextAdapter implements ContextProvider {
  @Override
  public List<Context> context(String query) {
    return List.of();
  }
}
