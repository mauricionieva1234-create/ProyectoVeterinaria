-- Up Migration

-- La hora de llegada es la hora real de la urgencia y no se reescribe ni
-- siquiera cuando el ingreso se marca como urgente.
CREATE OR REPLACE FUNCTION fn_ingreso_hora_llegada_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.hora_llegada <> OLD.hora_llegada THEN
    RAISE EXCEPTION 'La hora de llegada del ingreso no se puede modificar';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ingreso_hora_llegada_inmutable
BEFORE UPDATE ON ingreso
FOR EACH ROW EXECUTE FUNCTION fn_ingreso_hora_llegada_inmutable();

-- El paso al consultorio no puede ser anterior a la llegada.
ALTER TABLE ingreso
  ADD CONSTRAINT ingreso_hora_consultorio_posterior CHECK (
    hora_ingreso_consultorio IS NULL OR hora_ingreso_consultorio >= hora_llegada
  );

-- La cola ordena por urgencia y número de orden dentro del día.
CREATE INDEX ingreso_fecha_prioridad_orden_idx
  ON ingreso (fecha_dia, prioridad, numero_orden);

-- Down Migration

DROP INDEX IF EXISTS ingreso_fecha_prioridad_orden_idx;
ALTER TABLE ingreso DROP CONSTRAINT IF EXISTS ingreso_hora_consultorio_posterior;
DROP TRIGGER IF EXISTS ingreso_hora_llegada_inmutable ON ingreso;
DROP FUNCTION IF EXISTS fn_ingreso_hora_llegada_inmutable();
