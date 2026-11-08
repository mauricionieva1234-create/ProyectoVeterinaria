-- Up Migration

CREATE TABLE control (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  visita_origen_id bigint NOT NULL REFERENCES visita (id) ON DELETE RESTRICT,
  fecha_control date NOT NULL,
  franja text NOT NULL,
  motivo text,
  estado text NOT NULL DEFAULT 'pendiente',
  control_nuevo_id bigint REFERENCES control (id) ON DELETE RESTRICT,
  visita_realizada_id bigint REFERENCES visita (id) ON DELETE RESTRICT,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT control_franja_valida CHECK (franja IN ('manana', 'tarde', 'cualquiera')),
  CONSTRAINT control_estado_valido CHECK (
    estado IN ('pendiente', 'realizado', 'ausente', 'cancelado', 'reprogramado')
  ),
  CONSTRAINT control_no_reprogramado_a_si_mismo CHECK (
    control_nuevo_id IS NULL OR control_nuevo_id <> id
  ),
  CONSTRAINT control_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX control_paciente_idx ON control (paciente_id, fecha_control);
CREATE INDEX control_fecha_estado_idx ON control (fecha_control, estado);
CREATE INDEX control_visita_origen_idx ON control (visita_origen_id);

CREATE TABLE aviso_control (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  control_id bigint NOT NULL REFERENCES control (id) ON DELETE RESTRICT,
  canal text NOT NULL,
  resultado text NOT NULL,
  nota text,
  realizado_por bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  realizado_en timestamptz NOT NULL DEFAULT now(),
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  -- correo y whatsapp_automatico quedan previstos para fases futuras.
  CONSTRAINT aviso_control_canal_valido CHECK (
    canal IN ('llamada', 'whatsapp_manual', 'correo', 'whatsapp_automatico')
  ),
  CONSTRAINT aviso_control_resultado_valido CHECK (
    resultado IN ('avisado', 'no_contesta', 'sin_telefono', 'pidio_reprogramar')
  ),
  CONSTRAINT aviso_control_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX aviso_control_control_idx ON aviso_control (control_id, realizado_en DESC);

CREATE TRIGGER control_actualizado_en
BEFORE UPDATE ON control
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER aviso_control_actualizado_en
BEFORE UPDATE ON aviso_control
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS aviso_control;
DROP TABLE IF EXISTS control;
