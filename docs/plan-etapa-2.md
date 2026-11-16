# Plan de trabajo · Etapa 2 (cobros y caja)

## Alcance

Cobro de las visitas cerradas, pagos parciales o totales por medio, deudas y
cierre diario calculado. Se apoya en la migración `014_cobros.sql` y no toca las
tablas clínicas existentes.

**Incluye**

- Un cobro por visita cerrada, con total manual.
- Cobro sin cargo (total 0) con observación obligatoria.
- Pagos parciales o totales por efectivo, débito, crédito o transferencia.
- Deudas: cobros activos con saldo pendiente.
- Cierre del día por medio, calculado y con impresión desde el navegador.
- Estado `esperando_cobro` en la cola y paso a `atendido` al quedar pagado.
- Anulación lógica de cobros y pagos, solo para admin, con motivo.
- Permisos, auditoría y pantalla de caja.

**No incluye**

- Lista de precios con historial.
- Detalle del cobro por ítem o por servicio.
- Venta de productos, stock y facturación fiscal.
- Persistencia del cierre de caja.
- Cobros de turnos, cirugías o cualquier entidad que no sea una visita.

## Decisiones acordadas

1. **Un cobro por visita.** La migración crea un índice único parcial sobre
   `cobro (visita_id) WHERE anulado = false`. Si el cobro se anula, la visita
   puede generar uno nuevo.
2. **Total manual.** Hasta que exista la lista de precios, el importe lo carga
   el usuario. El backend lo valida y lo redondea a dos decimales.
3. **Sin cargo.** Un total en 0 registra la visita sin cargo, deja el cobro
   `pagado` y exige una observación de al menos 3 caracteres.
4. **Pagos.** Un cobro puede tener varios pagos. No se acepta un pago mayor al
   saldo ni un monto menor o igual a cero. El estado se recalcula dentro de la
   misma transacción con bloqueo `FOR UPDATE`.
5. **Estados.** `pendiente` (sin pagos), `parcial` (con pagos y saldo) y
   `pagado` (saldo 0). El saldo no se guarda: se calcula con la suma de pagos
   activos.
6. **Cola.** Al cerrar la visita, el ingreso asociado pasa a `esperando_cobro`.
   Cuando el cobro queda pagado, pasa a `atendido`. No se marca `atendido` a
   mano desde la cola.
7. **Anulaciones.** Cobros y pagos se anulan con motivo y no se borran. Solo el
   admin anula. Un cobro con pagos activos no se puede anular: primero hay que
   anular los pagos. Anular un pago no revierte un ingreso ya `atendido`; la
   deuda vuelve a aparecer.
8. **Cierre del día.** Se calcula al consultarlo, con la zona
   `America/Argentina/Tucumán` y solo pagos activos. Se imprime desde el
   navegador; no se persiste.
9. **Roles.** Admin, veterinario y recepción cobran, ven la caja y registran
   pagos. Solo admin anula.
10. **Bloqueo de la visita.** Una visita con cobro activo no se puede anular.
    Si además tiene pagos, tampoco se pueden anular los pagos sin motivo.

## Backend

### Migración `014_cobros.sql`

- Agrega `esperando_cobro` al `CHECK` de `ingreso.estado`. El rollback convierte
  los ingresos en ese estado a `atendido`.
- Crea `cobro`: `visita_id`, `total numeric(12,2)`, `estado`, `observaciones`,
  anulación lógica, timestamps y usuarios de creación/edición.
- Crea `pago`: `cobro_id`, `medio`, `monto numeric(12,2)`, `fecha`,
  `registrado_por`, anulación lógica y timestamps.
- Constraints: total no negativo, estados y medios válidos, anulación completa y
  monto positivo.
- Índices: un cobro activo por visita, estado, fecha de creación, pagos por
  cobro, fecha de pago y pagos activos por cobro.
- Triggers `fn_actualizar_actualizado_en()` en ambas tablas.

### Módulo `cobros`

| Método | Endpoint | Permiso | Uso |
|---|---|---|---|
| GET | `/api/cobros` | `cobros.ver` | Listado paginado con filtros por estado, paciente y fecha |
| GET | `/api/cobros/:id` | `cobros.ver` | Detalle con pagos |
| GET | `/api/cobros/pendientes` | `cobros.ver` | Visitas cerradas sin cobro |
| GET | `/api/cobros/deudas` | `cobros.ver` | Cobros activos con saldo |
| GET | `/api/cobros/caja` | `caja.ver` | Resumen del día y pagos |
| POST | `/api/cobros` | `cobros.crear` | Crear el cobro de una visita |
| PATCH | `/api/cobros/:id` | `cobros.editar` | Corregir total u observaciones con motivo |
| POST | `/api/cobros/:id/anular` | `cobros.anular` | Anular con motivo (solo admin) |
| POST | `/api/cobros/:id/pagos` | `pagos.registrar` | Registrar un pago |
| POST | `/api/cobros/:id/pagos/:pagoId/anular` | `pagos.anular` | Anular un pago con motivo (solo admin) |

Reglas:

- `POST /api/cobros` exige `visitaId`, `total` y, si el total es 0,
  `observaciones`. La visita debe existir, no estar anulada, estar `cerrada` o
  `corregida` y no tener otro cobro activo.
- Si el total es 0, el cobro nace `pagado` y el ingreso pasa a `atendido`.
- `PATCH` exige `motivoCambio` y no permite dejar el total por debajo de lo ya
  pagado. Recalcula el estado y audita antes/después.
- `POST /pagos` valida medio y monto, toma el saldo con el cobro bloqueado y
  rechaza pagos que lo superen. Audita el pago y el cambio de estado del cobro.
- `POST /pagos/:pagoId/anular` exige que el pago exista, pertenezca al cobro y
  no esté anulado. Recalcula el estado y audita.
- El cobro con pagos activos no se puede anular.
- Cada alta, edición y anulación audita `cobro` y `pago`; el paso del ingreso a
  `atendido` también se audita.
- Los listados devuelven paciente, cliente, visita e ingreso resumidos. El
  detalle agrega los pagos.

### Módulo `visitas`

- `cerrarVisita` deja el ingreso asociado en `esperando_cobro` y devuelve la
  visita releída para que el frontend vea el estado nuevo.
- `anularVisita` bloquea la anulación si la visita tiene un cobro activo o
  pagos, con un mensaje que indica qué hacer primero.

### Respuesta de la caja

`GET /api/cobros/caja?fecha=aaaa-mm-dd` devuelve:

```json
{
  "caja": {
    "fecha": "2026-11-15",
    "porMedio": [{ "medio": "efectivo", "cantidad": 2, "total": 9000 }],
    "totalCobrado": 9000,
    "cantidadPagos": 2,
    "pagos": [],
    "cobrosCreados": 3,
    "totalCreado": 15000,
    "deudaTotal": 6000,
    "cantidadDeudas": 1,
    "pendientes": 1
  }
}
```

`porMedio` siempre trae los cuatro medios, incluso en cero. La fecha por defecto
es la de Tucumán.

### Archivos

```
backend/migrations/014_cobros.sql
backend/src/modulos/cobros/esquemas.js
backend/src/modulos/cobros/repositorio.js
backend/src/modulos/cobros/servicio.js
backend/src/modulos/cobros/controlador.js
backend/src/modulos/cobros/rutas.js
backend/src/config/permisos.js
backend/src/modulos/visitas/servicio.js
backend/src/rutas.js
backend/tests/cobros.test.js
backend/tests/visitas.test.js
```

## Frontend

- `api/cobros.js`: cliente de cobros, pagos, deudas, pendientes y caja.
- `utils/etiquetasCobros.js`: etiquetas de medios y estados, formato de moneda
  es-AR y clases estáticas de color.
- `paginas/Caja.jsx`:
  - Tarjetas de cobrado hoy, cobros creados, deuda acumulada y pendientes.
  - Pendientes de cobro con acción «Cobrar».
  - Deudas con acciones de pago, edición y anulación según permisos.
  - Cobros del día.
  - Movimientos del día con anulación de pagos para admin.
  - Cierre por medio, selector de fecha e impresión. En impresión se oculta el
    resto de la pantalla.
- `componentes/FormularioCobro.jsx`: alta con pago inicial opcional y edición del
  total con motivo. Valida el cobro sin cargo y el pago que supera el total.
- `componentes/FormularioPago.jsx`: medio y monto, con el saldo como valor
  inicial.
- `paginas/Cola.jsx`: etiqueta `esperando_cobro`, color propio y acción «Cobrar»
  que lleva a la caja.
- `paginas/Visita.jsx`: aviso «Pendiente de cobro» con enlace a la caja.
- `componentes/Layout.jsx` y `rutas.jsx`: enlace «Caja» y ruta `/caja` protegida
  con `caja.ver`.
- `paginas/Inicio.jsx`: acceso rápido a la caja y texto actualizado.
- `utils/formato.js`: `fechaHoy()` en la zona de Tucumán para el selector de
  fecha.

## Tests

**Backend** (`tests/cobros.test.js`, `tests/visitas.test.js`)

- Crear un cobro sobre una visita cerrada y rechazarlo si la visita está en
  borrador, anulada o ya tiene un cobro activo.
- Cobro sin cargo con total 0 y observación obligatoria; pasa a `pagado` y el
  ingreso a `atendido`.
- Pagos parciales y total; estado `parcial` y `pagado`; rechazo de pago mayor al
  saldo y de monto no positivo.
- Edición del total con motivo; rechazo si queda por debajo de lo pagado.
- Anulación de pagos y cobros; un cobro con pagos activos no se anula.
- Cierre del día por medio, deuda total y pendientes.
- Permisos: recepción y veterinario cobran y pagan; solo admin anula; sin sesión
  da `401`.
- Cierre de visita deja el ingreso `esperando_cobro` y bloquea la anulación de
  la visita con cobro activo.

**Frontend** (`Caja.test.jsx`, `Cola.test.jsx`)

- La caja muestra pendientes, deudas, cobros del día y el cierre por medio.
- El formulario de cobro aparece desde un pendiente y el pago inicial se pide
  solo con total mayor que cero.
- El formulario de pago toma el saldo de la deuda.
- Recepción no ve anulaciones; admin ve las de cobros y pagos.
- La cola muestra «Esperando cobro» y el enlace «Cobrar» a la caja.

## Verificación

1. `npm run db:migrate` y `npm run db:migrate:test`.
2. `npm run test`, `npm run lint`, `npm run format:check` y `npm run build`.
3. Prueba manual con datos demo:
   - Cerrar una visita y verificar que el ingreso queda en «Esperando cobro».
   - Entrar a la caja, cobrar con pago parcial y comprobar la deuda.
   - Registrar el pago restante y verificar que el ingreso pasa a «Atendido».
   - Crear un cobro sin cargo y comprobar la observación obligatoria.
   - Anular un pago como admin y ver que la deuda reaparece.
   - Imprimir el cierre del día y verificar los totales por medio.
4. Resumen de cambios, supuestos y decisiones para aprobación.

## Supuestos

1. El cobro pertenece siempre a una visita; no se cobran turnos ni servicios
   sueltos en esta etapa.
2. El total se carga a mano. Cuando exista la lista de precios, se reemplaza el
   ingreso manual sin cambiar el modelo del cobro.
3. Un cobro sin cargo no genera pagos y se considera saldado.
4. El cierre del día es un resumen operativo, no un asiento contable. Se puede
   recalcular en cualquier momento.
5. Anular un pago no devuelve el ingreso de `atendido` a `esperando_cobro`: la
   visita ya se atendió y la deuda queda visible en caja.
6. La caja es una pantalla única para los tres roles; las acciones se ocultan
   según permisos, pero el backend vuelve a validar cada una.
7. El detalle por ítem y la venta de productos quedan para una etapa posterior.

## Commits previstos

1. `docs: agrega plan de la etapa de cobros`
2. `feat: agrega backend de cobros y pagos`
3. `test: agrega pruebas de cobros y caja`
4. `feat: agrega pantalla de caja y formularios de cobro`
5. `feat: integra el estado esperando cobro en la cola`
6. `test: agrega pruebas de caja y cola`
7. `docs: actualiza el modelo y el estado de las fases`
