-- Up Migration

-- pg_trgm permite búsquedas por similitud (tipo "contiene") con índices GIN.
-- unaccent permite que "Pérez" y "Perez" se encuentren con la misma búsqueda.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Normaliza un texto para buscar: minúsculas y sin tildes.
-- Se declara IMMUTABLE para poder usarla dentro de índices.
-- `unaccent` se califica con el esquema porque, al crear un índice, PostgreSQL
-- inlinea esta función y resuelve el cuerpo con un search_path restringido.
-- La extensión se crea en `public` más arriba.
CREATE OR REPLACE FUNCTION fn_sin_tildes(valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(public.unaccent(coalesce(valor, '')));
$$;

-- Mantiene actualizado_en al día en cada UPDATE. En el INSERT la columna
-- tiene DEFAULT now(), así que no hace falta tocar nada.
CREATE OR REPLACE FUNCTION fn_actualizar_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

-- Down Migration

DROP FUNCTION IF EXISTS fn_actualizar_actualizado_en();
DROP FUNCTION IF EXISTS fn_sin_tildes(text);

-- Las extensiones no se eliminan: pueden estar en uso por otras aplicaciones
-- que compartan la misma base.
