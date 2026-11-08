-- Up Migration

CREATE TABLE visita (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  ingreso_id bigint REFERENCES ingreso (id) ON DELETE RESTRICT,
  veterinario_id bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  inicio_en timestamptz NOT NULL DEFAULT now(),
  cierre_en timestamptz,
  estado text NOT NULL DEFAULT 'borrador',
  motivo_consulta text,
  anamnesis text,
  temperatura_c numeric(4, 1),
  peso_kg numeric(6, 2),
  diagnostico text,
  observaciones text,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT visita_estado_valido CHECK (estado IN ('borrador', 'cerrada', 'corregida')),
  CONSTRAINT visita_temperatura_valida CHECK (
    temperatura_c IS NULL OR (temperatura_c >= 20 AND temperatura_c <= 50)
  ),
  CONSTRAINT visita_peso_valido CHECK (peso_kg IS NULL OR peso_kg > 0),
  CONSTRAINT visita_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX visita_paciente_idx ON visita (paciente_id);
CREATE INDEX visita_veterinario_idx ON visita (veterinario_id);
CREATE INDEX visita_inicio_idx ON visita (inicio_en DESC);
CREATE INDEX visita_estado_idx ON visita (estado);

-- Cada edición de una visita cerrada guarda una foto completa del estado
-- anterior en contenido (jsonb).
CREATE TABLE visita_version (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visita_id bigint NOT NULL REFERENCES visita (id) ON DELETE RESTRICT,
  numero integer NOT NULL,
  contenido jsonb NOT NULL,
  motivo_cambio text,
  modificado_por bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  modificado_en timestamptz NOT NULL DEFAULT now(),
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT visita_version_numero_positivo CHECK (numero > 0)
);

CREATE UNIQUE INDEX visita_version_numero_unico ON visita_version (visita_id, numero);
CREATE INDEX visita_version_visita_idx ON visita_version (visita_id);

-- Las notas agregadas después del cierre no sobrescriben el texto original.
CREATE TABLE visita_nota (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visita_id bigint NOT NULL REFERENCES visita (id) ON DELETE RESTRICT,
  texto text NOT NULL,
  autor_id bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT visita_nota_texto_no_vacio CHECK (btrim(texto) <> '')
);

CREATE INDEX visita_nota_visita_idx ON visita_nota (visita_id);

CREATE TABLE medicacion (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visita_id bigint NOT NULL REFERENCES visita (id) ON DELETE RESTRICT,
  medicamento text NOT NULL,
  dosis text,
  via text,
  frecuencia text,
  duracion_dias integer,
  indicaciones text,
  peso_referencia_kg numeric(6, 2),
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  anulado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT medicacion_medicamento_no_vacio CHECK (btrim(medicamento) <> ''),
  CONSTRAINT medicacion_duracion_valida CHECK (duracion_dias IS NULL OR duracion_dias >= 0),
  CONSTRAINT medicacion_peso_valido CHECK (
    peso_referencia_kg IS NULL OR peso_referencia_kg > 0
  ),
  CONSTRAINT medicacion_anulacion_completa CHECK (
    NOT anulado
    OR (
      motivo_anulacion IS NOT NULL
      AND anulado_por IS NOT NULL
      AND anulado_en IS NOT NULL
    )
  )
);

CREATE INDEX medicacion_visita_idx ON medicacion (visita_id);

CREATE TRIGGER visita_actualizado_en
BEFORE UPDATE ON visita
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER visita_version_actualizado_en
BEFORE UPDATE ON visita_version
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER visita_nota_actualizado_en
BEFORE UPDATE ON visita_nota
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER medicacion_actualizado_en
BEFORE UPDATE ON medicacion
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS medicacion;
DROP TABLE IF EXISTS visita_nota;
DROP TABLE IF EXISTS visita_version;
DROP TABLE IF EXISTS visita;
