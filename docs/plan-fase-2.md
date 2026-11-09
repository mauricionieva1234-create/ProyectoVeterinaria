# Plan de trabajo · Fase 2

## Alcance

Clientes, pacientes y catálogos de especies/razas. Es la base sobre la que se
apoyan la cola, las visitas y los registros de las fases siguientes.

**Incluye**

- Búsqueda previa de clientes por documento y teléfono.
- Alta y edición de clientes con aviso de documento duplicado (no bloquea).
- Ficha de cliente con sus pacientes y listado de fichas incompletas.
- Alta y edición de pacientes con código interno automático.
- Historial de dueños del paciente.
- Unión de clientes duplicados (solo admin).
- Catálogos de especies y razas (consulta para todos, alta solo admin).
- Auditoría de crear, editar, unir y ver dato sensible.

**No incluye (fase 3 en adelante)**

- Cola de espera e ingresos.
- Alta rápida: necesita un ingreso con urgencia posible o confirmada.
- Visitas, registros clínicos, controles y adjuntos.

## Backend

| Módulo | Endpoints |
|---|---|
| catálogos | `GET /api/catalogos/especies`, `GET /api/catalogos/razas?especieId=`, `POST /api/catalogos/especies`, `POST /api/catalogos/razas` |
| clientes | `GET /api/clientes`, `GET /api/clientes/buscar`, `GET /api/clientes/fichas-incompletas`, `GET /api/clientes/:id`, `POST /api/clientes`, `PUT /api/clientes/:id`, `POST /api/clientes/:id/unir` |
| pacientes | `GET /api/pacientes`, `GET /api/pacientes/:id`, `POST /api/pacientes`, `PUT /api/pacientes/:id` |

Reglas:

- Documento duplicado: el alta devuelve `409 CLIENTE_DUPLICADO` con los
  candidatos. Si el usuario confirma, reenvía con `confirmarDuplicado: true` y
  se crea igual.
- El documento se enmascara en los listados. La ficha lo muestra completo y
  registra `ver_sensible` en la auditoría.
- `ficha_incompleta` del cliente = sin teléfono principal. Se recalcula al
  guardar.
- `ficha_incompleta` del paciente = provisorio, sin fecha de nacimiento o sin
  raza. Se recalcula al guardar.
- Al cambiar el dueño de un paciente se cierra el tramo actual del historial y
  se abre uno nuevo.
- Unir clientes reasigna los pacientes y su historial, y marca el cliente
  absorbido con `fusionado_en_cliente_id`.
- Fechas `date` se devuelven como `YYYY-MM-DD` para no cruzar zonas horarias.

## Frontend

- `Clientes`: buscador, listado paginado, alta y acceso a la ficha.
- `FichaCliente`: datos, edición, pacientes, alta de paciente y unión (admin).
- `FichaPaciente`: datos, dueño, historial y edición.
- `FichasIncompletas`: clientes sin teléfono principal.
- `Catalogos`: especies y razas, alta solo admin con sugerencias.
- Menú y rutas actualizados. Formato es-AR.

## Tests

- Catálogos: alta de especie/raza, duplicados, permisos.
- Clientes: alta, auditoría, duplicado con confirmación, búsqueda con tildes,
  enmascarado en listado, ficha completa/incompleta, unión.
- Pacientes: código interno, historial de dueños, raza de otra especie,
  recálculo de ficha incompleta, permisos.
- Frontend: listado de clientes y validaciones del formulario.

## Decisiones

1. Alta rápida se implementa en la fase 3 junto con la cola.
2. Unión de duplicados se incluye ahora, solo para admin.
3. Documento enmascarado en listados para todos los roles; completo en la ficha
   con auditoría `ver_sensible`.
4. Recepción ve y edita datos administrativos del cliente y del paciente; no
   accede a lo clínico.
5. El paciente provisorio se modela ahora, pero se crea desde la alta rápida en
   la fase 3.
