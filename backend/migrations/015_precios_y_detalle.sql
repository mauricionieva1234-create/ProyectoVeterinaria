-- Up Migration

-- Lista de precios de servicios. El nombre y el importe vigentes viven acá; los
-- cambios quedan en precio_historial para poder reconstruir la evolución.
CREATE TABLE precio (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  importe numeric(12, 2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  observaciones text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT precio_nombre_valido CHECK (length(btrim(nombre)) >= 2),
  CONSTRAINT precio_importe_no_negativo CHECK (importe >= 0)
);

-- Solo puede haber un precio activo con el mismo nombre, sin importar
-- mayúsculas ni tildes. Los inactivos quedan como historial.
CREATE UNIQUE INDEX precio_nombre_activo_unico
  ON precio (lower(fn_sin_tildes(nombre)))
  WHERE activo = true;

CREATE INDEX precio_activo_idx ON precio (activo);

-- Cada cambio de nombre o importe deja una fila. Es append-only: no se edita ni
-- se borra, y permite mostrar el antes y el después con su motivo.
CREATE TABLE precio_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  precio_id bigint NOT NULL REFERENCES precio (id) ON DELETE RESTRICT,
  nombre_anterior text,
  nombre_nuevo text NOT NULL,
  importe_anterior numeric(12, 2),
  importe_nuevo numeric(12, 2) NOT NULL,
  motivo text NOT NULL,
  cambiado_por bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  cambiado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT precio_historial_importe_nuevo_no_negativo CHECK (importe_nuevo >= 0),
  CONSTRAINT precio_historial_importe_anterior_no_negativo CHECK (
    importe_anterior IS NULL OR importe_anterior >= 0
  )
);

CREATE INDEX precio_historial_precio_idx ON precio_historial (precio_id, cambiado_en DESC);

-- Detalle del cobro. Guarda un snapshot del nombre y del importe para que un
-- cambio posterior en la lista de precios no altere cobros ya realizados.
CREATE TABLE cobro_item (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cobro_id bigint NOT NULL REFERENCES cobro (id) ON DELETE RESTRICT,
  precio_id bigint REFERENCES precio (id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  importe_unitario numeric(12, 2) NOT NULL,
  subtotal numeric(12, 2) GENERATED ALWAYS AS (round(cantidad * importe_unitario, 2)) STORED,
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT cobro_item_nombre_valido CHECK (length(btrim(nombre)) >= 2),
  CONSTRAINT cobro_item_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT cobro_item_importe_no_negativo CHECK (importe_unitario >= 0)
);

CREATE INDEX cobro_item_cobro_idx ON cobro_item (cobro_id);
CREATE INDEX cobro_item_precio_idx ON cobro_item (precio_id);

CREATE TRIGGER precio_actualizado_en
BEFORE UPDATE ON precio
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

CREATE TRIGGER cobro_item_actualizado_en
BEFORE UPDATE ON cobro_item
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_actualizado_en();

-- Down Migration

DROP TRIGGER IF EXISTS cobro_item_actualizado_en ON cobro_item;
DROP TRIGGER IF EXISTS precio_actualizado_en ON precio;
DROP TABLE IF EXISTS cobro_item;
DROP TABLE IF EXISTS precio_historial;
DROP TABLE IF EXISTS precio;
