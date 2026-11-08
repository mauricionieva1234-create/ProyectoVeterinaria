-- Up Migration

CREATE TABLE archivo_adjunto (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  visita_id bigint REFERENCES visita (id) ON DELETE RESTRICT,
  estudio_id bigint REFERENCES registro_estudio (id) ON DELETE RESTRICT,
  nombre_original text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  ruta_almacenamiento text NOT NULL,
  subido_por bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT archivo_adjunto_nombre_no_vacio CHECK (btrim(nombre_original) <> ''),
  CONSTRAINT archivo_adjunto_tamano_valido CHECK (tamano_bytes >= 0),
  CONSTRAINT archivo_adjunto_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX archivo_adjunto_paciente_idx ON archivo_adjunto (paciente_id);
CREATE INDEX archivo_adjunto_visita_idx ON archivo_adjunto (visita_id);
CREATE INDEX archivo_adjunto_estudio_idx ON archivo_adjunto (estudio_id);

CREATE TABLE configuracion_franja_control (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  hora_desde time NOT NULL,
  hora_hasta time NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT configuracion_franja_nombre_valido CHECK (nombre IN ('manana', 'tarde')),
  CONSTRAINT configuracion_franja_horario_valido CHECK (hora_desde < hora_hasta)
);

CREATE UNIQUE INDEX configuracion_franja_nombre_unico
  ON configuracion_franja_control (nombre);

-- La foto del paciente se agrega recién ahora porque archivo_adjunto
-- referencia a paciente y no se puede crear antes.
ALTER TABLE paciente
  ADD COLUMN foto_adjunto_id bigint REFERENCES archivo_adjunto (id) ON DELETE RESTRICT;

CREATE INDEX paciente_foto_idx ON paciente (foto_adjunto_id);

CREATE TRIGGER archivo_adjunto_actualizado_en
BEFORE UPDATE ON archivo_adjunto
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER configuracion_franja_control_actualizado_en
BEFORE UPDATE ON configuracion_franja_control
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

ALTER TABLE paciente DROP COLUMN IF EXISTS foto_adjunto_id;
DROP TABLE IF EXISTS configuracion_franja_control;
DROP TABLE IF EXISTS archivo_adjunto;
