# Plan de trabajo · Etapa 3 (lista de precios y detalle del cobro)

## Alcance

Lista de precios con historial de cambios y detalle del cobro por ítem. Se apoya
en una migración nueva (`015_precios_y_detalle.sql`) y conserva el cobro con
total manual para los casos en que no haga falta detallar.

**Incluye**

- Catálogo de precios con nombre, importe, estado activo e historial de cambios.
- Historial de cada precio: importe y nombre anteriores, importe y nombre
  nuevos, motivo, usuario y fecha.
- Detalle del cobro por ítem, con cantidad, importe unitario, subtotal y
  snapshot del nombre del precio al momento de cobrar.
- Ítems manuales (concepto libre) cuando no están en la lista.
- Cálculo automático del total del cobro cuando se cargan ítems.
- Compatibilidad con el total manual existente.
- Pantalla `/precios` para consultar y administrar la lista.
- Detalle del cobro desde la caja, con ítems y pagos.
- Permisos, auditoría, seeds demo, documentación y tests.

**No incluye**

- Venta de productos, stock o inventario.
- Facturación fiscal ni comprobantes electrónicos.
- Descuentos, recargos, impuestos o listas de precios múltiples por sucursal.
- Persistencia del cierre de caja.
- Edición de ítems de un cobro anulado.

## Decisiones acordadas

1. **Precio actual e historial separados.** `precio` guarda el valor vigente;
   `precio_historial` guarda cada cambio con anterior, nuevo, motivo, usuario y
   fecha. El historial es append-only.
2. **Nada se borra.** Un precio que deja de usarse se desactiva. Los cobros
   viejos conservan el nombre y el importe del momento del cobro.
3. **Snapshot por ítem.** `cobro_item` copia `nombre` e `importe_unitario`. Si
   luego cambia la lista, el cobro no se modifica.
4. **Total calculado o manual.** Si llegan ítems, el backend calcula el total y
   descarta el total enviado. Si no llegan ítems, se mantiene el total manual de
   la etapa 2.
5. **Edición coherente.** Un cobro detallado se edita con ítems, no solo con un
   total. Un cobro manual se sigue editando con total. En ambos casos el total
   no puede quedar por debajo de lo ya pagado y se exige motivo.
6. **Sin cargo.** Un total 0, sea manual o por ítems, exige observación de al
   menos 3 caracteres y deja el cobro `pagado`.
7. **Ítems reemplazables.** La edición del detalle reemplaza las líneas dentro
   de una transacción. La auditoría del cobro guarda el antes y el después
   completos, con ítems.
8. **Permisos.** Todos los roles que cobran pueden consultar la lista. Solo el
   admin crea, corrige, desactiva y reactiva precios. El backend es la
   autoridad; el frontend solo oculta acciones.
9. **Importes.** Se guardan como `numeric(12,2)` y se redondean por línea. El
   total es la suma de los subtotales redondeados, para que coincida con lo que
   muestra la base.
10. **Precio inactivo.** No se ofrece en el formulario de cobro, pero los
    cobros históricos que lo usaron lo siguen mostrando por snapshot.

## Backend

### Migración `015_precios_y_detalle.sql`

- **precio**: `nombre`, `importe numeric(12,2)`, `activo`, `observaciones`,
  timestamps y usuarios de creación/edición. Índice único parcial por nombre
  activo, comparando sin mayúsculas ni tildes.
- **precio_historial**: `precio_id`, `nombre_anterior`, `nombre_nuevo`,
  `importe_anterior`, `importe_nuevo`, `motivo`, `cambiado_por`, `cambiado_en`.
- **cobro_item**: `cobro_id`, `precio_id` (opcional), `nombre`, `cantidad`,
  `importe_unitario` y `subtotal` generado. Constraints de cantidad positiva,
  importe no negativo y nombre no vacío.
- Índices por cobro y por precio; triggers de `actualizado_en` donde
  corresponde.
- Rollback: elimina `cobro_item`, `precio_historial` y `precio`. `cobro.total`
  no cambia, así que los cobros existentes siguen siendo válidos.

### Módulo `precios`

| Método | Endpoint | Permiso | Uso |
|---|---|---|---|
| GET | `/api/precios` | `precios.ver` | Lista activa por defecto; `incluirInactivos=true` para ver todo |
| GET | `/api/precios/:id` | `precios.ver` | Detalle con historial |
| POST | `/api/precios` | `precios.crear` | Alta (solo admin) |
| PATCH | `/api/precios/:id` | `precios.editar` | Cambiar nombre, importe, observaciones o estado con motivo |

Reglas:

- El nombre se compara sin mayúsculas ni tildes para evitar duplicados activos.
- `PATCH` exige `motivo`. Si cambia el nombre o el importe, agrega una fila al
  historial; si solo cambia el estado o las observaciones, alcanza con la
  auditoría.
- Crear un precio también deja el primer registro del historial.
- Desactivar no borra ni oculta el historial. Reactivar vuelve a validar que no
  exista otro activo con el mismo nombre.
- Cada alta y edición audita la entidad `precio`.

### Cobros con ítems

- `POST /api/cobros` acepta `items` además de `total`. Si `items` está presente,
  el total se calcula y el `total` enviado se ignora.
- `PATCH /api/cobros/:id` acepta `items` o `total`. Si el cobro ya tiene ítems y
  se intenta editar solo con total, se rechaza para no dejar el detalle
  desincronizado.
- Los ítems se validan con Zod: nombre de 2 a 200 caracteres, cantidad entera
  positiva y hasta 9999, importe entre 0 y el máximo permitido.
- Si un `precioId` no existe, se rechaza con `DATOS_INVALIDOS`; un ítem manual
  lleva `precioId: null`.
- El detalle del cobro (`GET /api/cobros/:id`) y los listados incluyen `items`.
- La auditoría de crear/editar cobro guarda los ítems en el antes y el después.

## Frontend

- `api/precios.js`: listar, obtener, crear y actualizar precios.
- `paginas/Precios.jsx`:
  - Búsqueda por nombre y filtro para incluir inactivos.
  - Lista con importe, estado y última actualización.
  - Alta y edición en modal, con motivo obligatorio al editar.
  - Historial desplegable por precio.
  - Acciones de administración solo para admin.
- `componentes/FormularioCobro.jsx`:
  - Selector «Detallado por ítem» / «Total manual».
  - En modo detallado: agregar y quitar líneas, elegir un precio de la lista o
    escribir un concepto manual, cantidad e importe unitario.
  - Total calculado en vivo; el pago inicial sigue disponible cuando el total
    es mayor que cero.
  - En modo manual se conserva el comportamiento de la etapa 2.
  - Edición con motivo, respetando si el cobro nació detallado o manual.
- `paginas/Caja.jsx`:
  - Acción «Detalle» en deudas y cobros del día.
  - Modal con ítems, subtotales, pagos activos y anulados, observaciones y
    totales.
- `componentes/Layout.jsx` y `rutas.jsx`: enlace «Precios» y ruta `/precios`
  protegida con `precios.ver`.
- `utils/etiquetasCobros.js`: helpers de importes si hacen falta.

## Tests

**Backend**

- `tests/precios.test.js`: alta, duplicados, permisos, historial, edición con
  motivo, desactivación y reactivación.
- `tests/cobros.test.js`: cobro con ítems calcula total y subtotales; snapshot
  tras cambiar el precio; edición de ítems por debajo de lo pagado; total 0 con
  observación; rechazo de cobro detallado editado solo con total; total manual
  sigue funcionando.

**Frontend**

- `Precios.test.jsx`: lista, búsqueda, alta y edición con motivo; recepción no
  ve acciones de administración.
- `Caja.test.jsx`: el formulario de cobro permite cargar ítems y calcula el
  total; el detalle muestra ítems y pagos.

## Verificación

1. `npm run db:migrate` y `npm run db:migrate:test`.
2. `npm run test`, `npm run lint`, `npm run format:check` y `npm run build`.
3. Prueba manual con datos demo:
   - Crear un precio, cambiar el importe con motivo y ver el historial.
   - Desactivar un precio y comprobar que no aparece al cobrar.
   - Cobrar una visita con dos ítems y verificar total y subtotales.
   - Cambiar el precio de la lista y comprobar que el cobro viejo no cambia.
   - Registrar un pago parcial y editar los ítems sin bajar de lo pagado.
   - Abrir el detalle del cobro desde la caja.
4. Resumen de cambios, supuestos y decisiones.

## Supuestos

1. La lista de precios es única para toda la veterinaria; no hay listas por
   sucursal ni por tipo de cliente.
2. Los precios pueden ser 0 (por ejemplo, una cortesía), pero un cobro total 0
   siempre exige observación.
3. La cantidad es entera; no se venden fracciones de un servicio.
4. El importe unitario se puede corregir en el cobro aunque venga de la lista,
   para permitir un ajuste puntual sin cambiar el precio global.
5. El detalle por ítem no reemplaza la venta de productos ni el stock: son
   conceptos de servicios o conceptos libres.
6. No se edita un cobro anulado ni se agregan ítems a un cobro con pagos que
   superen el nuevo total.
7. El cierre de caja sigue siendo un resumen calculado e imprimible, sin
   persistencia.

## Commits previstos

1. `docs: agrega plan de lista de precios y detalle del cobro`
2. `feat: agrega migracion de precios e items del cobro`
3. `feat: agrega backend de precios con historial`
4. `feat: agrega items al cobro y calcula el total`
5. `test: agrega pruebas de precios e items del cobro`
6. `feat: agrega pantalla de precios y detalle en caja`
7. `test: agrega pruebas de precios y cobro detallado`
8. `docs: actualiza el modelo y la documentacion de la etapa`
