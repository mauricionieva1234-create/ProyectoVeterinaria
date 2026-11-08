-- Up Migration

CREATE TABLE ingreso (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  fecha_dia date NOT NULL,
  numero_orden integer NOT NULL,
  hora_llegada timestamptz NOT NULL DEFAULT now(),
  servicio text NOT NULL,
  prioridad text NOT NULL DEFAULT 'normal',
  urgencia_estado text NOT NULL DEFAULT 'sin_marca',
  urgencia_confirmada_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  urgencia_confirmada_en timestamptz,
  hora_ingreso_consultorio timestamptz,
  estado text NOT NULL DEFAULT 'esperando',
  comentario text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT ingreso_numero_orden_positivo CHECK (numero_orden > 0),
  CONSTRAINT ingreso_servicio_valido CHECK (
    servicio IN ('atencion_clinica', 'vacunacion', 'control', 'cirugia', 'otro')
  ),
  CONSTRAINT ingreso_prioridad_valida CHECK (prioridad IN ('normal', 'urgente')),
  CONSTRAINT ingreso_urgencia_estado_valido CHECK (
    urgencia_estado IN ('sin_marca', 'posible', 'confirmada', 'descartada')
  ),
  CONSTRAINT ingreso_estado_valido CHECK (
    estado IN (
      'esperando',
      'en_consulta',
      'atendido',
      'se_retiro',
      'cancelado',
      'sin_cerrar'
    )
  ),
  -- Si la urgencia fue confirmada, tienen que quedar registrados quién y cuándo.
  CONSTRAINT ingreso_urgencia_confirmada_completa CHECK (
    urgencia_estado <> 'confirmada'
    OR (urgencia_confirmada_por IS NOT NULL AND urgencia_confirmada_en IS NOT NULL)
  )
);

-- El número de orden reinicia cada día.
CREATE UNIQUE INDEX ingreso_fecha_numero_unico ON ingreso (fecha_dia, numero_orden);
CREATE INDEX ingreso_fecha_estado_idx ON ingreso (fecha_dia, estado);
CREATE INDEX ingreso_paciente_idx ON ingreso (paciente_id);

CREATE TRIGGER ingreso_actualizado_en
BEFORE UPDATE ON ingreso
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS ingreso;
