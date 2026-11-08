-- Up Migration

-- Secuencia para el código interno legible del paciente (PAC-000001).
CREATE SEQUENCE paciente_codigo_interno_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE paciente (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id bigint NOT NULL REFERENCES cliente (id) ON DELETE RESTRICT,
  codigo_interno text NOT NULL DEFAULT (
    'PAC-' || lpad(nextval('paciente_codigo_interno_seq')::text, 6, '0')
  ),
  nombre text NOT NULL,
  especie_id bigint NOT NULL REFERENCES especie (id) ON DELETE RESTRICT,
  raza_id bigint REFERENCES raza (id) ON DELETE RESTRICT,
  sexo text NOT NULL,
  castrado boolean NOT NULL DEFAULT false,
  fecha_castracion date,
  es_reproductor boolean NOT NULL DEFAULT false,
  fecha_nacimiento date,
  nacimiento_aproximado boolean NOT NULL DEFAULT false,
  fecha_deceso date,
  origen text,
  chip_codigo text,
  color text,
  comentario text,
  provisorio boolean NOT NULL DEFAULT false,
  ficha_incompleta boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT paciente_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  CONSTRAINT paciente_sexo_valido CHECK (sexo IN ('macho', 'hembra', 'desconocido')),
  CONSTRAINT paciente_origen_valido CHECK (
    origen IS NULL OR origen IN ('criado', 'adoptado', 'rescatado', 'otro')
  ),
  CONSTRAINT paciente_deceso_posterior_nacimiento CHECK (
    fecha_deceso IS NULL OR fecha_nacimiento IS NULL OR fecha_deceso >= fecha_nacimiento
  )
);

CREATE UNIQUE INDEX paciente_codigo_interno_unico ON paciente (codigo_interno);
CREATE INDEX paciente_cliente_idx ON paciente (cliente_id);
CREATE INDEX paciente_especie_idx ON paciente (especie_id);
CREATE INDEX paciente_raza_idx ON paciente (raza_id);
CREATE INDEX paciente_nombre_trgm_idx ON paciente USING gin (fn_sin_tildes(nombre) gin_trgm_ops);

CREATE TABLE paciente_dueno_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id bigint NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  cliente_id bigint NOT NULL REFERENCES cliente (id) ON DELETE RESTRICT,
  desde date NOT NULL DEFAULT current_date,
  hasta date,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT historial_fechas_validas CHECK (hasta IS NULL OR hasta >= desde)
);

CREATE INDEX paciente_historial_paciente_idx ON paciente_dueno_historial (paciente_id);
CREATE INDEX paciente_historial_cliente_idx ON paciente_dueno_historial (cliente_id);

CREATE TRIGGER paciente_actualizado_en
BEFORE UPDATE ON paciente
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER paciente_dueno_historial_actualizado_en
BEFORE UPDATE ON paciente_dueno_historial
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS paciente_dueno_historial;
DROP TABLE IF EXISTS paciente;
DROP SEQUENCE IF EXISTS paciente_codigo_interno_seq;
