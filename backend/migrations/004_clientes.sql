-- Up Migration

CREATE TABLE cliente (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  apellido text NOT NULL,
  tipo_documento text NOT NULL,
  nro_documento text NOT NULL,
  telefono_principal text,
  telefono_es_whatsapp boolean NOT NULL DEFAULT false,
  telefono_alternativo text,
  email text,
  calle_numero text,
  localidad_barrio text,
  provincia text,
  pais text NOT NULL DEFAULT 'Argentina',
  acepta_correo boolean NOT NULL DEFAULT false,
  acepta_whatsapp boolean NOT NULL DEFAULT false,
  fecha_consentimiento date,
  observaciones text,
  alta_rapida boolean NOT NULL DEFAULT false,
  ficha_incompleta boolean NOT NULL DEFAULT false,
  fusionado_en_cliente_id bigint REFERENCES cliente (id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT cliente_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  CONSTRAINT cliente_apellido_no_vacio CHECK (btrim(apellido) <> ''),
  CONSTRAINT cliente_documento_no_vacio CHECK (btrim(nro_documento) <> ''),
  CONSTRAINT cliente_tipo_documento_valido CHECK (
    tipo_documento IN ('DNI', 'pasaporte', 'otro')
  ),
  CONSTRAINT cliente_no_fusionado_consigo_mismo CHECK (
    fusionado_en_cliente_id IS NULL OR fusionado_en_cliente_id <> id
  )
);

-- El documento NO es único: ante un duplicado se avisa y no se bloquea el alta.
CREATE INDEX cliente_documento_idx ON cliente (nro_documento);
CREATE INDEX cliente_telefono_idx ON cliente (telefono_principal);
CREATE INDEX cliente_email_idx ON cliente (lower(email));

-- Índices trigram para búsquedas por nombre y apellido sin tildes.
CREATE INDEX cliente_nombre_trgm_idx ON cliente USING gin (fn_sin_tildes(nombre) gin_trgm_ops);
CREATE INDEX cliente_apellido_trgm_idx
  ON cliente USING gin (fn_sin_tildes(apellido) gin_trgm_ops);

CREATE TRIGGER cliente_actualizado_en
BEFORE UPDATE ON cliente
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TABLE IF EXISTS cliente;
