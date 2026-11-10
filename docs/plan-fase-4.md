# Plan de trabajo · Fase 4

## Alcance

Historial clínico completo: visitas, medicación, registros por tipo, controles,
avisos y adjuntos. Se apoya en el esquema que ya existe en las migraciones 007
a 010.

**Incluye**

- Visitas clínicas con borrador, cierre, corrección versionada, notas y
  medicación.
- Inicio de visita desde la ficha del paciente o desde la cola del día.
- Registros de vacunas, antiparasitarios, estudios y cirugías, con alta, edición
  y anulación.
- Controles que nacen de una visita, lista de recordatorios de hoy y mañana,
  paso automático a `ausente` y reprogramación.
- Avisos manuales por llamada o WhatsApp manual.
- Adjuntos reales: foto del paciente, archivos de visita y resultados de
  estudios. Los archivos quedan fuera de la carpeta pública y se sirven solo con
  sesión válida.
- Historial clínico en la ficha del paciente, con pestañas por tipo.
- Pantalla de controles para recepción y veterinarios.
- Permisos y auditoría de todas las operaciones clínicas.
- Completar especie y nombre del paciente provisorio al iniciar la visita.

**No incluye**

- Cobros y caja (etapa 2).
- Turnos, recordatorios automáticos por correo o WhatsApp, stock y reportes.
- Unión de clientes duplicados (fase posterior).
- Firma digital, recetas imprimibles y adjuntos en la nube.

## Decisiones acordadas

1. **Adjuntos:** subida real con `multer`, almacenamiento local fuera de la
   carpeta pública, límite de 10 MB y tipos permitidos PDF, JPG, PNG y WebP.
   Incluye foto del paciente, adjuntos de visita y resultados de estudios.
2. **Visitas:** en borrador se editan libremente. Al cerrar se exige motivo de
   consulta. Editar una visita cerrada exige motivo de cambio, guarda una
   versión con el estado anterior y deja la visita en `corregida`. Se permiten
   notas posteriores y anulación con motivo. Al cerrar la visita, el ingreso
   asociado pasa a `atendido`.
3. **Controles:** al consultar las listas, los pendientes vencidos pasan a
   `ausente` y se auditan. Reprogramar crea otro control y deja el original como
   `reprogramado`. Veterinario y admin crean y reprograman; recepción gestiona
   avisos. `realizado` se puede marcar sin visita, con vínculo opcional.
4. **Registros:** los cuatro tipos completos, con alta, edición y anulación.
   Incluye medicación y notas dentro de la visita y pestañas de historial
   clínico en la ficha del paciente.

## Backend

### Migración

Las tablas clínicas ya existen. La fase 4 agrega `012_clinica_reglas.sql` con
refuerzos, sin crear ni renombrar columnas:

- Índice único parcial para que un ingreso tenga una sola visita activa:
  `visita (ingreso_id) WHERE ingreso_id IS NOT NULL AND anulado = false`.
- Restricción de coherencia en `visita`: `cierre_en` es nulo si y solo si el
  estado es `borrador`.
- Restricción de coherencia en `control`: `control_nuevo_id` existe si y solo si
  el estado es `reprogramado`.
- Índice `control (estado, fecha_control)` para las listas de recordatorios.
- Índice parcial `archivo_adjunto (paciente_id) WHERE anulado = false` para los
  listados vigentes.

### Módulo `visitas`

| Método | Endpoint | Permiso | Uso |
|---|---|---|---|
| GET | `/api/visitas` | `visitas.ver` | Listado paginado y filtros |
| GET | `/api/visitas/:id` | `visitas.ver` | Detalle con medicación, notas y versiones |
| POST | `/api/visitas` | `visitas.crear` | Iniciar visita |
| PATCH | `/api/visitas/:id` | `visitas.editar` | Editar borrador o corregir cerrada |
| POST | `/api/visitas/:id/cerrar` | `visitas.editar` | Cerrar la visita |
| POST | `/api/visitas/:id/notas` | `visitas.editar` | Agregar nota posterior |
| POST | `/api/visitas/:id/anular` | `visitas.anular` | Anular con motivo |
| POST | `/api/visitas/:id/medicacion` | `visitas.editar` | Agregar medicación |
| PATCH | `/api/visitas/:id/medicacion/:medicacionId` | `visitas.editar` | Editar medicación |
| POST | `/api/visitas/:id/medicacion/:medicacionId/anular` | `visitas.anular` | Anular medicación |

Reglas:

- `veterinario_id` es el usuario que inicia la visita. Admin también puede
  iniciarla y queda registrado como responsable.
- `POST /api/visitas` acepta `pacienteId`, `ingresoId` opcional y los datos
  clínicos iniciales.
- Si viene `ingresoId`, el ingreso debe pertenecer al mismo paciente y estar en
  `esperando` o `en_consulta`. Si está `esperando`, la operación lo pasa a
  `en_consulta`, guarda la hora de ingreso al consultorio y audita el cambio.
  Un ingreso ya cerrado o con visita activa da `409 CONFLICTO`.
- Si el paciente es provisorio, la visita exige `especieId` y acepta `nombre`.
  Esos datos se actualizan en el paciente dentro de la misma transacción y se
  auditan. No se borra la marca `provisorio`: indica que nació de un alta
  rápida.
- En `borrador` se editan todos los campos sin motivo.
- Cerrar exige `motivoConsulta` no vacío. Guarda `cierre_en`, deja
  `estado = 'cerrada'` y, si hay ingreso abierto, lo pasa a `atendido`.
- Editar una visita `cerrada` o `corregida` exige `motivoCambio`. Antes del
  cambio se guarda en `visita_version` una foto del estado anterior, incluida la
  medicación vigente, con número correlativo. La visita queda en `corregida`.
- Las notas solo se agregan a visitas cerradas o corregidas. Son inmutables y no
  generan versión.
- Cambiar medicación de una visita cerrada o corregida también exige
  `motivoCambio` y genera una versión antes del cambio. En borrador es libre.
- Una visita anulada no admite cambios. La anulación exige motivo y no borra
  nada.
- El detalle devuelve los campos clínicos (`anamnesis`, temperatura, peso,
  diagnóstico, observaciones, medicación) solo con `visitas.ver_clinico`. El
  listado nunca los incluye.
- Cada alta, edición, cierre, nota, anulación y cambio de medicación se audita
  con `antes` y `despues`. Las visitas versionadas no se editan ni se borran.

### Módulo `registros`

| Método | Endpoint | Permiso | Uso |
|---|---|---|---|
| GET | `/api/pacientes/:pacienteId/registros` | `registros.ver` | Historial por tipo |
| POST | `/api/registros/:tipo` | `registros.crear` | Alta del registro |
| PATCH | `/api/registros/:tipo/:id` | `registros.editar` | Edición |
| POST | `/api/registros/:tipo/:id/anular` | `registros.anular` | Anulación con motivo |

`tipo` admite `vacuna`, `antiparasitario`, `estudio` y `cirugia`.

Reglas:

- `paciente_id` es obligatorio. `visita_id` es opcional; si viene, la visita
  debe pertenecer al mismo paciente y no estar anulada.
- En vacunas y antiparasitarios, `aplicada_por` / `aplicado_por` se completan con
  el usuario de la sesión si no se indica otro veterinario activo.
- Fechas de aplicación y próximas dosis se guardan como `date`.
- Estudios: `pedido` → `realizado` → `resultado_cargado`. Al pasar a
  `resultado_cargado` se exige `fechaResultado`. No se permite retroceder.
- Cirugías: `programada` → `realizada`, `suspendida` o `cancelada`. Una cirugía
  suspendida o cancelada es final. Si está `programada`, se exige fecha
  programada.
- La anulación exige motivo y completa `anulado`, `motivo_anulacion`,
  `anulado_por` y `anulado_en`. Nunca se borra la fila.
- Recepción no accede a registros clínicos: `403` en todos los endpoints del
  módulo.
- Cada alta, edición y anulación se audita.

### Módulo `controles`

| Método | Endpoint | Permiso | Uso |
|---|---|---|---|
| GET | `/api/controles` | `controles.ver` | Listado paginado con filtros |
| GET | `/api/controles/recordar` | `controles.ver` | Pendientes de hoy y mañana |
| GET | `/api/controles/:id` | `controles.ver` | Detalle con avisos |
| POST | `/api/controles` | `controles.crear` | Crear desde una visita |
| POST | `/api/controles/:id/reprogramar` | `controles.editar` | Reprogramar |
| PATCH | `/api/controles/:id/estado` | `controles.editar` | Realizado, ausente o cancelado |
| POST | `/api/controles/:id/anular` | `controles.editar` | Anular con motivo |
| GET | `/api/controles/:id/avisos` | `avisos.ver` | Historial de avisos |
| POST | `/api/controles/:id/avisos` | `avisos.crear` | Registrar aviso |

Reglas:

- El control nace de una visita no anulada (`visitaOrigenId`). El paciente se
  toma de la visita y no se puede indicar otro.
- `fechaControl` no puede ser anterior a hoy. `franja` admite `manana`, `tarde`
  o `cualquiera`.
- Antes de listar controles o recordatorios se ejecuta el cierre diferido: todo
  control `pendiente` con `fecha_control < hoy` pasa a `ausente` y se audita con
  el usuario que hizo la consulta. Se usa `hoyEnTucuman()`, no la fecha del
  servidor.
- `GET /api/controles/recordar` devuelve `{ hoy, manana }` con paciente, código,
  dueño, teléfono, franja, motivo y último aviso. Recepción ve esta lista aunque
  no tenga permisos clínicos.
- `GET /api/controles?estado=ausente` devuelve los vencidos para volver a
  contactar, paginados.
- Reprogramar se permite desde `pendiente` o `ausente`. Crea un control nuevo
  con la fecha y franja pedidas, deja el original en `reprogramado` y guarda
  `control_nuevo_id`. Ambos cambios se auditan.
- Marcar `realizado` acepta `visitaRealizadaId` opcional; si viene, la visita
  debe ser del mismo paciente.
- Los avisos usan canal `llamada` o `whatsapp_manual` y resultado `avisado`,
  `no_contesta`, `sin_telefono` o `pidio_reprogramar`. Se guarda el usuario y la
  fecha. Los avisos son inmutables: si hubo un error, se agrega otro aviso.
- Recepción puede ver controles y avisos, y registrar avisos. No puede crear,
  reprogramar, cambiar estado ni anular controles.

### Módulo `adjuntos`

Dependencia nueva: `multer`.

| Método | Endpoint | Permiso | Uso |
|---|---|---|---|
| GET | `/api/adjuntos` | `adjuntos.ver` | Listar por paciente, visita o estudio |
| POST | `/api/adjuntos` | `adjuntos.crear` | Subir un archivo |
| GET | `/api/adjuntos/:id/descargar` | `adjuntos.ver` | Descargar o ver |
| POST | `/api/adjuntos/:id/anular` | `adjuntos.anular` | Anular con motivo |
| POST | `/api/pacientes/:id/foto` | `pacientes.editar` + `adjuntos.crear` | Subir foto |
| POST | `/api/pacientes/:id/foto/quitar` | `pacientes.editar` | Quitar foto actual |

Reglas:

- Los archivos se guardan en `backend/uploads/adjuntos` por defecto. La ruta se
  puede cambiar con `ADJUNTOS_DIR` en `.env`. La carpeta está fuera de
  `frontend` y ya está contemplada por `uploads/` en `.gitignore`.
- Nombre de archivo aleatorio con `crypto.randomUUID()` y extensión derivada del
  MIME permitido, nunca del nombre original. Se guarda la ruta relativa en la
  base.
- Límite de 10 MB por archivo. MIME permitidos: `application/pdf`, `image/jpeg`,
  `image/png`, `image/webp`. Se rechazan SVG y cualquier otro tipo.
- Un archivo por petición, campo `archivo`.
- `pacienteId` es obligatorio salvo que venga `visitaId` o `estudioId`; en ese
  caso se deduce y se valida que todos pertenezcan al mismo paciente.
- La descarga exige sesión y permiso `adjuntos.ver`. Se envía el MIME guardado y
  un nombre seguro; si el archivo físico falta, se devuelve un error claro.
- Anular no borra el archivo físico: lo marca como anulado y lo excluye de los
  listados. Si era la foto del paciente, se limpia `foto_adjunto_id`.
- Recepción puede subir y descargar adjuntos, pero no anularlos.
- La foto del paciente se expone en la ficha como `fotoAdjuntoId`; el frontend
  la pide por el endpoint de descarga.
- Los errores de `multer` (tamaño, tipo, campo inesperado) se traducen al formato
  uniforme `{ error: { codigo, mensaje, detalles } }`.

### Archivos

```
backend/migrations/012_clinica_reglas.sql
backend/src/modulos/visitas/esquemas.js
backend/src/modulos/visitas/repositorio.js
backend/src/modulos/visitas/servicio.js
backend/src/modulos/visitas/controlador.js
backend/src/modulos/visitas/rutas.js
backend/src/modulos/registros/esquemas.js
backend/src/modulos/registros/repositorio.js
backend/src/modulos/registros/servicio.js
backend/src/modulos/registros/controlador.js
backend/src/modulos/registros/rutas.js
backend/src/modulos/controles/esquemas.js
backend/src/modulos/controles/repositorio.js
backend/src/modulos/controles/servicio.js
backend/src/modulos/controles/controlador.js
backend/src/modulos/controles/rutas.js
backend/src/modulos/adjuntos/esquemas.js
backend/src/modulos/adjuntos/repositorio.js
backend/src/modulos/adjuntos/servicio.js
backend/src/modulos/adjuntos/controlador.js
backend/src/modulos/adjuntos/rutas.js
backend/src/middlewares/archivos.js
backend/src/utils/archivos.js
backend/src/config/env.js
backend/src/config/permisos.js
backend/src/modulos/pacientes/repositorio.js
backend/src/modulos/pacientes/servicio.js
backend/src/modulos/cola/repositorio.js
backend/src/modulos/cola/servicio.js
backend/src/rutas.js
backend/.env.example
```

## Frontend

- `api/visitas.js`, `api/registros.js`, `api/controles.js` y `api/adjuntos.js`
  con TanStack Query.
- `utils/etiquetasClinicas.js`: etiquetas en español de estados de visita,
  registro, control, franja, canal y resultado de aviso.
- `componentes/RutaPermiso.jsx`: guarda de rutas por permiso, además de
  `RutaAdmin`.
- `paginas/Visitas.jsx` (veterinario y admin): listado paginado con filtros por
  paciente, estado y fecha.
- `paginas/Visita.jsx`:
  - Cabecera con paciente, dueño, ingreso y veterinario.
  - Formulario clínico editable en borrador.
  - Cierre con motivo obligatorio.
  - Corrección con motivo de cambio y aviso de que se genera una versión.
  - Medicación: alta, edición y anulación.
  - Notas posteriores.
  - Historial de versiones.
  - Creación de controles y adjuntos.
  - Anulación con motivo.
- `componentes/FormularioVisita.jsx`,
  `componentes/FormularioMedicacion.jsx`, `componentes/FormularioControl.jsx`,
  `componentes/FormularioAviso.jsx`, `componentes/FormularioRegistro.jsx`,
  `componentes/HistorialClinico.jsx`, `componentes/ListaAdjuntos.jsx` y
  `componentes/SubirAdjunto.jsx`.
- `paginas/Controles.jsx` (todos los roles): pendientes de hoy, de mañana y
  vencidos para volver a contactar. Muestra teléfono y franja. Recepción puede
  registrar avisos; veterinario y admin además reprograman, marcan realizado o
  cancelan.
- `paginas/FichaPaciente.jsx`: agrega foto, botón «Nueva visita» para
  veterinario/admin y pestañas de historial clínico. Recepción solo ve las
  pestañas de controles y adjuntos.
- `paginas/Cola.jsx`: agrega «Iniciar visita» para veterinario y admin cuando el
  ingreso está en espera o en consulta. Recepción no ve esa acción.
- `Layout.jsx`: enlaces «Visitas» (veterinario/admin) y «Controles» (todos).
- `rutas.jsx`: `/visitas`, `/visitas/:id` y `/controles`; las dos primeras
  protegidas con `visitas.ver`.
- `Inicio.jsx`: texto de la fase 4.
- Formato es-AR: `dd/mm/aaaa`, 24 horas, hora de Tucumán.

## Tests

**Backend**

- Visitas:
  - Iniciar desde un ingreso en espera lo pasa a `en_consulta` y guarda la hora.
  - Un ingreso cerrado o con visita activa da conflicto.
  - Borrador editable sin motivo; cierre sin motivo da `400`.
  - Cierre guarda `cierre_en` y deja el ingreso `atendido`.
  - Editar una cerrada sin motivo da `400`; con motivo genera versión con el
    estado anterior y deja `corregida`.
  - Notas solo en cerradas; son inmutables.
  - Anulación exige motivo y bloquea cambios posteriores.
  - Paciente provisorio: exige especie, actualiza especie y nombre y audita.
  - Recepción recibe `403` en todas las rutas de visitas.
- Medicación:
  - Alta y anulación en borrador.
  - Cambio en visita cerrada exige motivo y genera versión.
- Registros:
  - Alta, edición y anulación de los cuatro tipos.
  - Vacuna y antiparasitario completan el aplicador con el usuario.
  - Estudio no puede llegar a `resultado_cargado` sin fecha de resultado ni
    retroceder de estado.
  - Cirugía respeta sus transiciones y exige fecha si está programada.
  - Visita de otro paciente da conflicto.
  - Anulación sin motivo da `400`; recepción recibe `403`.
- Controles y avisos:
  - Control creado desde una visita; fecha pasada da `400`.
  - `recordar` devuelve hoy y mañana con teléfono y franja.
  - Un pendiente de ayer pasa a `ausente` al listar y se audita.
  - Reprogramar crea el nuevo, deja el original `reprogramado` y guarda el
    vínculo.
  - Marcar realizado con y sin visita.
  - Aviso creado por recepción; control no creado ni reprogramado por recepción
    (`403`).
- Adjuntos:
  - Subir PDF y PNG; listar y descargar con sesión.
  - Rechazar tipo no permitido, archivo mayor a 10 MB y archivo faltante.
  - Validar que visita, estudio y paciente pertenezcan al mismo paciente.
  - Anular exige motivo; recepción no puede anular.
  - Foto del paciente se asigna, se descarga y se limpia al anular.
  - Los archivos de test se guardan en una carpeta temporal y se limpian al
    terminar.
- Auditoría de visitas, medicación, registros, controles, avisos y adjuntos.
- Mapa de permisos: recepción puede `controles.ver`, `avisos.ver/crear`,
  `adjuntos.ver/crear`; no puede `visitas.*` ni `registros.*`.

**Frontend**

- El formulario de visita valida campos y exige motivo al cerrar.
- La corrección de una visita cerrada exige motivo de cambio.
- La cola muestra «Iniciar visita» a veterinario y no a recepción.
- La ficha del paciente muestra las pestañas clínicas a veterinario y solo
  controles/adjuntos a recepción.
- La pantalla de controles muestra hoy, mañana y vencidos, y recepción puede
  registrar un aviso.
- El formulario de registro arma el cuerpo esperado según el tipo.
- La subida de adjuntos valida tamaño y tipo antes de enviar.
- Etiquetas y formatos en español.

## Verificación

1. `npm install` para sumar `multer`.
2. `npm run db:migrate` y `npm run db:migrate:test`.
3. `npm run test`, `npm run lint`, `npm run format:check` y `npm run build`.
4. Prueba manual con la base real:
   - Veterinario inicia una visita desde la cola, completa especie de un
     paciente provisorio, agrega medicación y cierra la visita.
   - Corrige la visita con motivo y verifica la versión anterior.
   - Carga vacuna, antiparasitario, estudio y cirugía desde la ficha.
   - Crea un control, lo ve en «Controles», registra un aviso desde recepción y
     lo reprograma desde veterinario.
   - Sube un PDF como resultado de estudio y una foto de paciente; recepción los
     descarga; veterinario anula un adjunto con motivo.
   - Fuerza un control de ayer y verifica que pasa a `ausente`.
5. Resumen de cambios, supuestos y decisiones para aprobación.

## Supuestos

1. La columna `visita.cierre_en` queda nula solo en borradores. Si en el futuro
   se necesita reabrir una visita, se hace con una corrección, no volviendo a
   borrador.
2. La versión de una visita guarda la visita y su medicación vigente. Las notas
   no se versionan porque son inmutables y aditivas.
3. Los tags de `visita_version` y `visita_nota` quedan inmutables: no se editan
   ni se anulan.
4. Los avisos de control también son inmutables. Un error se corrige agregando
   otro aviso, no editando el anterior.
5. El cierre de controles vencidos es diferido, igual que el cierre de la cola:
   se ejecuta al consultar las listas y se audita con el usuario de la consulta.
6. La fecha de negocio se calcula con `hoyEnTucuman()`, no con la fecha del
   servidor.
7. Recepción no ve visitas ni registros clínicos. Su acceso clínico se limita a
   controles, avisos y adjuntos, como define el modelo.
8. Los archivos se guardan en disco local. La interfaz de almacenamiento queda
   aislada en `utils/archivos.js` para poder cambiarla en el futuro.
9. No se agregan permisos nuevos: el mapa existente ya contempla todas las
   acciones de la fase 4.
10. El seed demo se mantiene, y se le agregan registros ficticios de vacuna y
    estudio para probar las pestañas sin datos reales.

## Commits previstos

1. `docs: agrega plan de fase 4`
2. `feat: agrega backend de visitas y medicacion`
3. `feat: agrega backend de registros clinicos`
4. `feat: agrega backend de controles y avisos`
5. `feat: agrega backend de adjuntos`
6. `test: agrega pruebas clinicas del backend`
7. `feat: agrega pantallas de visitas y registros`
8. `feat: agrega pantallas de controles y adjuntos`
9. `test: agrega pruebas clinicas del frontend`
10. `chore: actualiza seed demo y documentacion de fase 4`
