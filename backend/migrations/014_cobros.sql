-- Up Migration

-- La visita cerrada queda esperando el cobro en caja. El estado se suma al
-- circuito de la cola sin tocar los estados existentes.
ALTER TABLE ingreso DROP CONSTRAINT ingreso_estado_valido;

ALTER TABLE ingreso
  ADD CONSTRAINT ingreso_estado_valido CHECK (
    estado IN (
      'esperando',
      'en_consulta',
      'esperando_cobro',
      'atendido',
      'se_retiro',
      'cancelado',
      'sin_cerrar'
    )
  );

-- Un cobro por visita. El total se carga a mano hasta que exista la lista de
-- precios. Las visitas sin cargo se guardan con total 0 y estado pagado.
CREATE TABLE cobro (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visita_id bigint NOT NULL REFERENCES visita (id) ON DELETE RESTRICT,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente',
  observaciones text,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT cobro_total_no_negativo CHECK (total >= 0),
  CONSTRAINT cobro_estado_valido CHECK (estado IN ('pendiente', 'parcial', 'pagado')),
  CONSTRAINT cobro_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

-- Una visita puede tener un solo cobro activo. Si el cobro se anula, la visita
-- queda libre para generar uno nuevo.
CREATE UNIQUE INDEX cobro_visita_activo_unico
  ON cobro (visita_id)
  WHERE anulado = false;

CREATE INDEX cobro_estado_idx ON cobro (estado) WHERE anulado = false;
CREATE INDEX cobro_creado_en_idx ON cobro (creado_en DESC);

-- Cada pago tiene un solo medio. Un cobro puede tener varios pagos parciales.
CREATE TABLE pago (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cobro_id bigint NOT NULL REFERENCES cobro (id) ON DELETE RESTRICT,
  medio text NOT NULL,
  monto numeric(12, 2) NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  registrado_por bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT pago_monto_positivo CHECK (monto > 0),
  CONSTRAINT pago_medio_valido CHECK (
    medio IN ('efectivo', 'debito', 'credito', 'transferencia')
  ),
  CONSTRAINT pago_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX pago_cobro_idx ON pago (cobro_id);
CREATE INDEX pago_fecha_idx ON pago (fecha);
CREATE INDEX pago_activo_cobro_idx ON pago (cobro_id) WHERE anulado = false;

CREATE TRIGGER cobro_actualizado_en
BEFORE UPDATE ON cobro
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER pago_actualizado_en
BEFORE UPDATE ON pago
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TRIGGER IF EXISTS pago_actualizado_en ON pago;
DROP TRIGGER IF EXISTS cobro_actualizado_en ON cobro;
DROP TABLE IF EXISTS pago;
DROP TABLE IF EXISTS cobro;

-- Antes de volver al constraint anterior, los ingresos que quedaron esperando
-- cobro se consideran atendidos.
ALTER TABLE ingreso DROP CONSTRAINT ingreso_estado_valido;
UPDATE ingreso SET estado = 'atendido' WHERE estado = 'esperando_cobro';

ALTER TABLE ingreso
  ADD CONSTRAINT ingreso_estado_valido CHECK (
    estado IN (
      'esperando',
      'en_consulta',
      'atendido',
      'se_retiro',
      'cancelado',
      'sin_cerrar'
    )
  );
