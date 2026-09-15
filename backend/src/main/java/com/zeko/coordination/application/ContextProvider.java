package com.zeko.coordination.application;

import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;

public interface ContextProvider {
  List<Context> context(ResourceId projectId, List<ResourceId> ownerIds,
                        String query);
  record Context(String sourceId, String level, String excerpt) {}
}
