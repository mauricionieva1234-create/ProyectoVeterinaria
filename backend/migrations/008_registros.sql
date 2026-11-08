-- Up Migration

CREATE TABLE registro_vacuna (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  visita_id bigint REFERENCES visita (id) ON DELETE RESTRICT,
  vacuna text NOT NULL,
  lote text,
  fecha_aplicacion date NOT NULL,
  fecha_proxima_dosis date,
  aplicada_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT registro_vacuna_vacuna_no_vacia CHECK (btrim(vacuna) <> ''),
  CONSTRAINT registro_vacuna_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX registro_vacuna_paciente_idx ON registro_vacuna (paciente_id, fecha_aplicacion DESC);
CREATE INDEX registro_vacuna_visita_idx ON registro_vacuna (visita_id);

CREATE TABLE registro_antiparasitario (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  visita_id bigint REFERENCES visita (id) ON DELETE RESTRICT,
  producto text NOT NULL,
  tipo text NOT NULL,
  dosis text,
  fecha_aplicacion date NOT NULL,
  fecha_proxima date,
  aplicado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT registro_antiparasitario_producto_no_vacio CHECK (btrim(producto) <> ''),
  CONSTRAINT registro_antiparasitario_tipo_valido CHECK (tipo IN ('interno', 'externo')),
  CONSTRAINT registro_antiparasitario_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX registro_antiparasitario_paciente_idx
  ON registro_antiparasitario (paciente_id, fecha_aplicacion DESC);
CREATE INDEX registro_antiparasitario_visita_idx ON registro_antiparasitario (visita_id);

CREATE TABLE registro_estudio (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  visita_id bigint REFERENCES visita (id) ON DELETE RESTRICT,
  tipo_estudio text NOT NULL,
  fecha_pedido date NOT NULL,
  estado text NOT NULL DEFAULT 'pedido',
  fecha_resultado date,
  resultado_resumen text,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT registro_estudio_tipo_no_vacio CHECK (btrim(tipo_estudio) <> ''),
  CONSTRAINT registro_estudio_estado_valido CHECK (
    estado IN ('pedido', 'realizado', 'resultado_cargado')
  ),
  CONSTRAINT registro_estudio_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX registro_estudio_paciente_idx ON registro_estudio (paciente_id, fecha_pedido DESC);
CREATE INDEX registro_estudio_visita_idx ON registro_estudio (visita_id);
CREATE INDEX registro_estudio_estado_idx ON registro_estudio (estado);

CREATE TABLE registro_cirugia (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  visita_id bigint REFERENCES visita (id) ON DELETE RESTRICT,
  tipo_cirugia text NOT NULL,
  fecha_programada date,
  estado text NOT NULL DEFAULT 'programada',
  indicaciones_previas text,
  notas_postoperatorio text,
  cirujano_id bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  visita_origen_id bigint REFERENCES visita (id) ON DELETE RESTRICT,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT registro_cirugia_tipo_no_vacio CHECK (btrim(tipo_cirugia) <> ''),
  CONSTRAINT registro_cirugia_estado_valido CHECK (
    estado IN ('programada', 'realizada', 'suspendida', 'cancelada')
  ),
  CONSTRAINT registro_cirugia_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX registro_cirugia_paciente_idx ON registro_cirugia (paciente_id, fecha_programada DESC);
CREATE INDEX registro_cirugia_visita_idx ON registro_cirugia (visita_id);
CREATE INDEX registro_cirugia_estado_idx ON registro_cirugia (estado);

CREATE TRIGGER registro_vacuna_actualizado_en
BEFORE UPDATE ON registro_vacuna
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER registro_antiparasitario_actualizado_en
BEFORE UPDATE ON registro_antiparasitario
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER registro_estudio_actualizado_en
BEFORE UPDATE ON registro_estudio
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER registro_cirugia_actualizado_en
BEFORE UPDATE ON registro_cirugia
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS registro_cirugia;
DROP TABLE IF EXISTS registro_estudio;
DROP TABLE IF EXISTS registro_antiparasitario;
DROP TABLE IF EXISTS registro_vacuna;
