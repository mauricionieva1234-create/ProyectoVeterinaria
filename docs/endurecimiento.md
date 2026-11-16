# Endurecimiento de la aplicación

Esta etapa no agrega funciones nuevas de negocio: mejora la seguridad de las
acciones delicadas, la accesibilidad, el rendimiento de carga y la confianza en
los backups. El dominio sigue definido en [`modelo-de-datos.md`](modelo-de-datos.md).

## Alcance

### 1. Confirmación fuerte al fusionar clientes

La fusión de clientes no se puede deshacer desde la aplicación. Antes se
ejecutaba con un solo clic; ahora el flujo tiene dos pasos:

1. Se elige el cliente que se conserva y se pulsa **Continuar**.
2. Se muestra un resumen con el cliente que se fusiona y el que se conserva, una
   advertencia de que la acción no se puede deshacer y un checkbox de
   confirmación. **Fusionar definitivamente** queda deshabilitado hasta marcarlo.

El backend no cambió: sigue exigiendo rol admin y auditando la unión.

### 2. Modales accesibles

`Modal.jsx` ahora:

- enfoca el primer control al abrir;
- mantiene Tab y Shift+Tab dentro del diálogo;
- cierra con Escape;
- bloquea el desplazamiento del fondo mientras está abierto;
- devuelve el foco al elemento que lo tenía al cerrar;
- usa un `aria-labelledby` único por instancia.

### 3. Carga por rutas

Las páginas se cargan con `React.lazy` y `Suspense`, y el asistente se descarga
solo si el usuario tiene el permiso `asistente.usar`. El paquete principal bajó
de 707,20 kB a 332,79 kB; el resto queda repartido en un archivo por pantalla.

### 4. Backups verificables

- `npm run db:backup` genera el `.dump` con la versión de `pg_dump` que coincide
  con la versión mayor del servidor y conserva los últimos 14 archivos
  (`--retencion=N` para cambiarlo).
- `npm run db:backup:verificar` restaura el backup más reciente en una base
  temporal, compara la cantidad de filas de todas las tablas públicas, revisa
  las extensiones `pg_trgm`/`unaccent` y la función `fn_sin_tildes`, y elimina la
  base temporal al terminar.
- Los scripts buscan la instalación correcta de PostgreSQL. Si no está en la
  ruta esperada, se puede indicar `PG_BIN`.

### 5. Prueba de flujo completo

`backend/tests/flujo-completo.test.js` recorre en una sola prueba:

alta de cliente → búsqueda por nombre y apellido en cualquier orden → alta de
paciente → ingreso a la cola → paso al consultorio → visita → edición → cierre →
paso a `esperando_cobro` → cobro → pago parcial → pago total → ingreso
`atendido` → caja del día → auditoría de toda la cadena.

## Verificación

| Comprobación | Resultado |
|---|---|
| `npm run test` | Backend 122/122, frontend 66/66 |
| `npm run lint` | Sin errores |
| `npm run format:check` | Todos los archivos formateados |
| `npm run build` | Correcto; `index` 332,79 kB y un chunk por página |
| `npm run db:backup` | Backup de 0,13 MB generado |
| `npm run db:backup:verificar` | 23 tablas coinciden; base temporal eliminada |
| Navegador: rutas diferidas | `Caja.jsx` se descarga al entrar a `/caja`, sin errores de consola |
| Navegador: modal | Foco atrapado, Escape cierra y el foco vuelve a **Unir duplicado** |
| Navegador: fusión | El resumen muestra ambos clientes y el botón sigue deshabilitado hasta confirmar |

La prueba de navegador de la fusión se hizo sin confirmar: se abrió el paso
final, se verificó el estado del botón y se canceló.

## Decisiones

- La confirmación de fusión es solo del frontend; el backend mantiene la regla
  de rol y auditoría.
- El foco de los modales se maneja con listeners de teclado propios, sin agregar
  dependencias.
- Los backups se verifican contra la base actual; por eso conviene correr la
  verificación con el backend detenido.
- El cierre de caja sigue sin persistirse: se calcula y se imprime. Guardar un
  histórico contable queda para una etapa futura.
- La rotación de backups es local al equipo; no reemplaza una copia externa.

## Pendientes

- Programar y probar la tarea de Windows en el equipo real de la veterinaria.
- Definir si el cierre de caja debe guardarse para consultas históricas.
- Evaluar una copia de seguridad fuera del equipo (disco externo o nube).
- Lista de precios con historial, detalle por ítem, productos y stock.
