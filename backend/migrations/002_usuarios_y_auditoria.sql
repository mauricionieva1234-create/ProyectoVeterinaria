-- Up Migration

CREATE TABLE usuario (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_completo text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  rol text NOT NULL,
  matricula text,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT usuario_nombre_no_vacio CHECK (btrim(nombre_completo) <> ''),
  CONSTRAINT usuario_email_no_vacio CHECK (btrim(email) <> ''),
  CONSTRAINT usuario_rol_valido CHECK (rol IN ('admin', 'veterinario', 'recepcion')),
  -- La matrícula solo tiene sentido para veterinarios.
  CONSTRAINT usuario_matricula_solo_veterinario CHECK (matricula IS NULL OR rol = 'veterinario')
);

-- El email se guarda en minúsculas desde la aplicación. El índice único sobre
-- lower(email) evita duplicados aunque algún dato viejo tenga mayúsculas.
CREATE UNIQUE INDEX usuario_email_unico ON usuario (lower(email));

CREATE TABLE auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  entidad text NOT NULL,
  entidad_id bigint NOT NULL,
  accion text NOT NULL,
  antes jsonb,
  despues jsonb,
  fecha timestamptz NOT NULL DEFAULT now(),
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT auditoria_entidad_no_vacia CHECK (btrim(entidad) <> ''),
  CONSTRAINT auditoria_accion_valida CHECK (
    accion IN ('crear', 'editar', 'anular', 'unir', 'ver_sensible')
  )
);

CREATE INDEX auditoria_entidad_idx ON auditoria (entidad, entidad_id);
CREATE INDEX auditoria_usuario_idx ON auditoria (usuario_id);
CREATE INDEX auditoria_fecha_idx ON auditoria (fecha DESC);

CREATE TRIGGER usuario_actualizado_en
BEFORE UPDATE ON usuario
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER auditoria_actualizado_en
BEFORE UPDATE ON auditoria
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS auditoria;
DROP TABLE IF EXISTS usuario;
