-- Bootstrap del almacen local de metadata.
-- SQLite es la fuente de verdad de metadata, configuracion, estados y trazabilidad.
-- Las tablas de producto llegan en migraciones posteriores, cada una con su propia tarea.

CREATE TABLE metadata_bootstrap (
    id           TEXT    NOT NULL PRIMARY KEY,
    schema_scope TEXT    NOT NULL,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    version      INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT metadata_bootstrap_scope_closed CHECK (schema_scope IN ('LOCAL_METADATA')),
    CONSTRAINT metadata_bootstrap_version_positive CHECK (version >= 1)
);

INSERT INTO metadata_bootstrap (id, schema_scope, created_at, updated_at, version)
VALUES ('00000000-0000-0000-0000-000000000001', 'LOCAL_METADATA', '2026-09-13T00:00:00Z', '2026-09-13T00:00:00Z', 1);
