-- Up Migration

CREATE TABLE especie (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT especie_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

CREATE UNIQUE INDEX especie_nombre_unico ON especie (lower(nombre));

CREATE TABLE raza (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  especie_id bigint NOT NULL REFERENCES especie (id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT raza_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

-- Una especie no puede tener dos razas con el mismo nombre (sin distinguir
-- mayúsculas ni tildes por errores de tipeo).
CREATE UNIQUE INDEX raza_especie_nombre_unico ON raza (especie_id, lower(nombre));
CREATE INDEX raza_especie_idx ON raza (especie_id);

CREATE TRIGGER especie_actualizado_en
BEFORE UPDATE ON especie
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER raza_actualizado_en
BEFORE UPDATE ON raza
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS raza;
DROP TABLE IF EXISTS especie;
