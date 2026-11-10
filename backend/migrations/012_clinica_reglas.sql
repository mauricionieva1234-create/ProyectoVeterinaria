-- Up Migration

-- Un ingreso puede generar una sola visita activa. Si la visita se anula, el
-- paciente puede volver a ingresar con el mismo ingreso.
CREATE UNIQUE INDEX visita_ingreso_unico
  ON visita (ingreso_id)
  WHERE ingreso_id IS NOT NULL AND anulado = false;

-- El borrador es el único estado sin cierre. Al cerrar se guarda la fecha y no
-- se vuelve atrás: una corrección mantiene el cierre original.
ALTER TABLE visita
  ADD CONSTRAINT visita_cierre_coherente CHECK ((estado = 'borrador') = (cierre_en IS NULL));

-- Un control reprogramado siempre apunta al control nuevo, y solo los
-- reprogramados tienen ese vínculo.
ALTER TABLE control
  ADD CONSTRAINT control_reprogramacion_coherente CHECK (
    (estado = 'reprogramado') = (control_nuevo_id IS NOT NULL)
  );

CREATE INDEX control_estado_fecha_idx ON control (estado, fecha_control);

CREATE INDEX archivo_adjunto_paciente_vigente_idx
  ON archivo_adjunto (paciente_id)
  WHERE anulado = false;

-- Down Migration

DROP INDEX IF EXISTS archivo_adjunto_paciente_vigente_idx;
DROP INDEX IF EXISTS control_estado_fecha_idx;
ALTER TABLE control DROP CONSTRAINT IF EXISTS control_reprogramacion_coherente;
ALTER TABLE visita DROP CONSTRAINT IF EXISTS visita_cierre_coherente;
DROP INDEX IF EXISTS visita_ingreso_unico;
