package com.zeko.traceability.application;

import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.domain.SafeDetail;
import com.zeko.traceability.domain.TraceLink;
import java.util.List;

public interface TraceRepository {

    void record(TraceLink link, SafeDetail detail);

    List<RecordedTrace> findByResource(ResourceId resourceId);

    record RecordedTrace(TraceLink link, SafeDetail detail) {
    }
}
