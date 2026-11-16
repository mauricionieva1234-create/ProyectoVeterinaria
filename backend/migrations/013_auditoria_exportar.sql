-- Up Migration

-- La entrega de la historia clínica a un titular queda auditada con una acción
-- propia. El resto de las acciones no cambia.
ALTER TABLE auditoria DROP CONSTRAINT auditoria_accion_valida;

ALTER TABLE auditoria
  ADD CONSTRAINT auditoria_accion_valida CHECK (
    accion IN ('crear', 'editar', 'anular', 'unir', 'ver_sensible', 'exportar')
  );

-- Down Migration

ALTER TABLE auditoria DROP CONSTRAINT auditoria_accion_valida;

ALTER TABLE auditoria
  ADD CONSTRAINT auditoria_accion_valida CHECK (
    accion IN ('crear', 'editar', 'anular', 'unir', 'ver_sensible')
  );
