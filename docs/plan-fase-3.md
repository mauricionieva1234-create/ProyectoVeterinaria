# Plan de trabajo · Fase 3

## Alcance

Cola de espera diaria, urgencias y alta rápida. Es la antesala de las visitas
clínicas de la fase 4.

**Incluye**

- Ingresos a la cola del día con numeración que reinicia cada día.
- Hora de llegada automática e inmutable.
- Recepción marca una posible urgencia; veterinario o admin la confirma o
  descarta.
- Ingreso al consultorio y cierre del ingreso (`atendido`, `se_retiro`,
  `cancelado`).
- Cierre de los ingresos que quedaron abiertos al terminar el día y lista de
  revisión de `sin_cerrar`.
- Alta rápida de una urgencia: cliente mínimo, paciente provisorio e ingreso
  urgente en una sola operación.
- Auditoría de altas y cambios de estado.
- Ajuste del seed demo para usar la fecha de Tucumán, igual que la cola.

**No incluye (fase 4 en adelante)**

- Visitas clínicas, anamnesis, medicación, diagnósticos y registros.
- Controles y avisos.
- Adjuntos.
- Cobros y caja (etapa 2).
- Turnos y recordatorios automáticos.

## Aclaración necesaria: alta rápida

El modelo dice que el alta rápida «solo está disponible si el ingreso está
marcado como posible o confirmada urgencia», pero también exige `paciente_id`
en `ingreso` y dice que el alta rápida crea el paciente. Es un círculo: no se
puede crear el ingreso sin paciente, y el paciente nace con el alta rápida.

**Propuesta:** el alta rápida crea en una sola transacción el cliente, el
paciente provisorio y el ingreso de urgencia. El ingreso nace con
`urgencia_estado = 'posible'` (recepción) o `'confirmada'` (veterinario/admin),
`prioridad = 'urgente'` y la fecha del día. Así se cumple la regla sin cambiar
el modelo: la operación siempre deja un ingreso marcado como urgencia.

El paciente provisorio se crea con `nombre = 'Sin nombre'`, `provisorio = true`,
`ficha_incompleta = true`, sexo `desconocido` y la especie `otro` del seed. El
veterinario indica la especie real al iniciar la visita en la fase 4.

Si se prefiere otro flujo (por ejemplo, permitir `paciente_id` nulo en un
pre-ingreso), hay que cambiar el modelo antes de implementar.

## Backend

### Migración

`006_cola.sql` ya crea la tabla `ingreso` completa. La fase 3 agrega
`011_cola_reglas.sql` con tres refuerzos, sin tocar columnas:

- Trigger que rechaza cualquier cambio de `hora_llegada`.
- Restricción `hora_ingreso_consultorio >= hora_llegada` cuando hay hora de
  consultorio.
- Índice `(fecha_dia, prioridad, numero_orden)` para ordenar la cola.

### Módulo `cola`

| Método | Endpoint | Permiso | Uso |
|---|---|---|---|
| GET | `/api/cola` | `cola.ver` | Cola de hoy |
| POST | `/api/cola` | `cola.crear` | Agregar un paciente existente |
| PATCH | `/api/cola/:id/urgencia-posible` | `cola.marcar_urgencia` | Marcar posible urgencia |
| PATCH | `/api/cola/:id/urgencia` | `cola.confirmar_urgencia` | Confirmar o descartar |
| PATCH | `/api/cola/:id/consultorio` | `cola.editar` | Pasar a `en_consulta` |
| PATCH | `/api/cola/:id/estado` | `cola.editar` | `atendido`, `se_retiro`, `cancelado` |
| GET | `/api/cola/sin-cerrar` | `cola.ver` | Lista de revisión paginada |
| POST | `/api/cola/alta-rapida` | `pacientes.alta_rapida` + `cola.crear` | Alta rápida de urgencia |

Reglas:

- `fecha_dia` se calcula con la zona `America/Argentina/Tucuman`, no con
  `current_date` del servidor. Se agrega `utils/fechas.js` con
  `hoyEnTucuman()`.
- `numero_orden` se obtiene con un lock de asesoría por fecha y
  `max(numero_orden) + 1`, dentro de la transacción. El índice único
  `(fecha_dia, numero_orden)` sigue siendo la última defensa.
- `hora_llegada = now()` y nunca se actualiza. El trigger de la migración lo
  impide incluso por SQL directo.
- Al crear un ingreso se puede marcar `marcarPosibleUrgencia: true`; en ese caso
  queda `urgencia_estado = 'posible'` y `prioridad = 'urgente'`.
- Un paciente no puede tener dos ingresos abiertos (`esperando` o
  `en_consulta`) el mismo día. Si pasa, `409 PACIENTE_EN_COLA`.
- Marcar posible urgencia se permite desde `sin_marca` o `descartada`. Si ya
  está `confirmada`, `409 URGENCIA_YA_CONFIRMADA`.
- Confirmar se permite desde `posible` o `sin_marca`; descartar solo desde
  `posible`. Al confirmar se guardan `urgencia_confirmada_por` y
  `urgencia_confirmada_en`; al descartar se limpian y la prioridad vuelve a
  `normal`.
- Pasar al consultorio solo desde `esperando`; guarda
  `hora_ingreso_consultorio = now()` y deja `estado = 'en_consulta'`.
- Los estados finales se permiten desde `esperando`, `en_consulta` o
  `sin_cerrar`.
- La cola solo devuelve el día actual. No acepta parámetro de fecha.
- Al listar la cola, crear un ingreso o listar `sin_cerrar`, primero se cierran
  los días anteriores: los ingresos con `fecha_dia < hoy` en `esperando` o
  `en_consulta` pasan a `sin_cerrar`. Cada cierre se audita con el usuario que
  hizo la consulta, porque no hay un usuario «sistema».
- `GET /api/cola/sin-cerrar` ordena por fecha descendente y número de orden, y
  pagina con `pagina` y `limite`.
- La respuesta de cada ingreso incluye paciente, código interno, dueño,
  teléfono, especie, raza, servicio, prioridad, urgencia, estado, horas y
  comentario. Las horas se devuelven como `timestamptz` ISO; `fecha_dia` como
  `YYYY-MM-DD`.
- Se audita `crear` y `editar` de `ingreso` con el estado antes y después. El
  alta rápida audita también `cliente` y `paciente`.

### Alta rápida

`POST /api/cola/alta-rapida` recibe:

```json
{
  "nombre": "Nombre",
  "apellido": "Apellido",
  "tipoDocumento": "DNI",
  "nroDocumento": "90000001",
  "servicio": "atencion_clinica",
  "urgencia": "posible",
  "comentario": null,
  "confirmarDuplicado": false
}
```

- `urgencia` solo admite `posible` o `confirmada`. Recepción no puede usar
  `confirmada`: el servicio lo valida con el mapa de permisos y devuelve `403`.
- Si el documento ya existe y no viene `confirmarDuplicado`, devuelve
  `409 CLIENTE_DUPLICADO` con los candidatos enmascarados, igual que el alta
  normal de clientes.
- Crea el cliente con `alta_rapida = true`, `ficha_incompleta = true` y sin
  teléfono.
- Crea el paciente provisorio con la especie `otro`. Si el seed no tiene esa
  especie, devuelve un error claro que pide ejecutar `npm run seed`.
- Abre el tramo de historial de dueño.
- Crea el ingreso del día con la urgencia pedida y prioridad urgente.
- Devuelve `{ cliente, paciente, ingreso }`.

### Archivos

```
backend/migrations/011_cola_reglas.sql
backend/src/utils/fechas.js
backend/src/modulos/cola/esquemas.js
backend/src/modulos/cola/repositorio.js
backend/src/modulos/cola/servicio.js
backend/src/modulos/cola/controlador.js
backend/src/modulos/cola/rutas.js
backend/src/rutas.js
backend/scripts/seed-demo.js
```

## Frontend

- `api/cola.js`: listar cola, crear ingreso, marcar posible urgencia,
  confirmar/descartar, pasar al consultorio, cambiar estado, listar
  `sin-cerrar` y alta rápida.
- `utils/etiquetasCola.js`: etiquetas en español de servicio, urgencia, estado y
  prioridad.
- `paginas/Cola.jsx`:
  - Fecha del día y contador de ingresos.
  - Tabla ordenada por urgencia y número de orden.
  - Acciones según estado y rol: marcar posible urgencia, confirmar, descartar,
    pasar al consultorio, atendido, se retiró, cancelar.
  - Botones «Agregar paciente» y «Alta rápida».
  - Actualización automática cada 30 segundos.
  - Enlaces a la ficha del paciente y del cliente.
- `componentes/SelectorPaciente.jsx`: búsqueda por nombre o código con
  `GET /api/pacientes?buscar=...&limite=8`.
- `componentes/FormularioIngreso.jsx`: paciente elegido, servicio, comentario y
  casilla «Marcar posible urgencia».
- `componentes/FormularioAltaRapida.jsx`: nombre, apellido, tipo y número de
  documento, servicio, urgencia, comentario. Recepción solo ve «Posible»;
  veterinario y admin pueden elegir «Confirmada». Maneja el `409` de documento
  duplicado con la opción «Crear igual», como el formulario de clientes.
- `paginas/IngresosSinCerrar.jsx`: listado paginado de revisión con acciones
  para resolver cada ingreso.
- `Layout.jsx`: enlaces «Cola del día» y «Sin cerrar».
- `rutas.jsx`: `/cola` y `/cola/sin-cerrar`.
- `Inicio.jsx`: texto de la fase 3.
- Formato es-AR: `dd/mm/aaaa`, 24 horas, hora de Tucumán.

## Tests

**Backend**

- Numeración diaria: dos ingresos del día reciben 1 y 2; el índice único impide
  duplicados.
- La fecha del ingreso es la de Tucumán.
- Crear ingreso normal y con posible urgencia; auditoría.
- Recepción marca posible urgencia; no puede confirmar (403); veterinario
  confirma y descarta; se guardan y limpian los datos de confirmación.
- Pasar al consultorio guarda la hora y deja `en_consulta`; repetirlo da
  conflicto.
- Estados finales y transiciones inválidas.
- La cola solo muestra el día actual y ordena urgencias primero.
- Cierre diferido: un ingreso de ayer en `esperando` y otro en `en_consulta`
  pasan a `sin_cerrar` al consultar la cola; aparecen en la lista de revisión.
- `hora_llegada` no se puede modificar por SQL directo.
- Alta rápida: cliente `alta_rapida` + `ficha_incompleta`, paciente provisorio
  «Sin nombre» con especie `otro`, ingreso urgente, auditoría de las tres
  entidades.
- Alta rápida con documento duplicado: 409 y confirmación.
- Recepción no puede crear alta rápida confirmada; veterinario sí.

**Frontend**

- La cola lista los ingresos del día y muestra la urgencia.
- Recepción no ve «Confirmar urgencia»; veterinario sí.
- El formulario de alta rápida valida los campos y arma el cuerpo esperado.
- El modal de alta rápida muestra los candidatos ante un documento duplicado.

## Verificación

1. `npm run db:migrate` y `npm run db:migrate:test`.
2. `npm run test`, `npm run lint`, `npm run format:check` y `npm run build`.
3. Prueba manual con la base real:
   - Recepción agrega un paciente, marca posible urgencia y crea un alta rápida.
   - Veterinario confirma la urgencia, pasa al consultorio y cierra el ingreso.
   - Se fuerza un ingreso de ayer y se verifica que aparece en «Sin cerrar».
4. Resumen de cambios, supuestos y decisiones para aprobación.

## Decisiones y supuestos

1. El alta rápida crea cliente, paciente provisorio e ingreso urgente en una
   sola transacción, como se explicó arriba.
2. La especie provisoria es `otro`, ya existente en el seed. No se agrega una
   especie nueva ni se permite `especie_id` nulo.
3. Se bloquea un segundo ingreso abierto del mismo paciente el mismo día.
4. El cierre de días anteriores es diferido: se ejecuta al consultar la cola o
   crear un ingreso, y se audita con el usuario de esa acción.
5. Confirmar urgencia se permite desde `posible` o `sin_marca`; descartar solo
   desde `posible`.
6. Recepción puede marcar posible urgencia y mover la cola, pero no confirmar ni
   descartar.
7. No se agregan permisos nuevos: el mapa existente ya contempla `cola.*` y
   `pacientes.alta_rapida`.
8. La cola siempre es la del día actual; no hay selector de fecha.
9. El seed demo se ajusta para usar la fecha de Tucumán en los ingresos.

## Commits previstos

1. `docs: agrega plan de fase 3`
2. `feat: agrega backend de cola urgencias y alta rapida`
3. `test: agrega pruebas de cola y alta rapida`
4. `feat: agrega pantallas de cola y alta rapida`
5. `test: agrega pruebas de cola en el frontend`
6. `chore: alinea seed demo con la fecha de tucuman`
