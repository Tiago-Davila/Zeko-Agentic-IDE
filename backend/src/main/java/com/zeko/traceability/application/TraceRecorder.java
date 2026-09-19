package com.zeko.traceability.application;

import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.domain.SafeDetail;
import com.zeko.traceability.domain.TraceLink;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class TraceRecorder {

    private final TraceRepository repository;

    public TraceRecorder(TraceRepository repository) {
        this.repository = Objects.requireNonNull(repository, "El repositorio de trazas es obligatorio");
    }

    public void record(TraceLink link, SafeDetail detail) {
        repository.record(Objects.requireNonNull(link, "El enlace es obligatorio"),
                Objects.requireNonNull(detail, "El detalle seguro es obligatorio"));
    }

    public List<TraceRepository.RecordedTrace> findByResource(ResourceId resourceId) {
        return repository.findByResource(Objects.requireNonNull(resourceId, "El recurso es obligatorio"));
    }
}
