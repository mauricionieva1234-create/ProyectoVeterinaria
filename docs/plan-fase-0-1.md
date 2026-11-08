# Plan de trabajo · Fases 0 y 1

Documento de planificación para revisar y aprobar antes de escribir código.
La fuente de verdad del dominio sigue siendo `docs/modelo-de-datos.md`.

## Estado inicial

- Repositorio: `C:\PRYECTOS - TUP\veterinaria`
- `docs/modelo-de-datos.md` copiado tal cual.
- `AGENTS.md` creado con stack, estructura, convenciones, reglas de dominio,
  seguridad y flujo de trabajo.
- Git inicializado en `main`.
- Sin código de la aplicación todavía.

---

# Fase 0 · Base del proyecto

**Objetivo:** monorepo con workspaces, backend Express con `GET /api/salud`,
frontend Vite + React + Tailwind + rutas, ESLint, Prettier, `.env.example`,
scripts y README inicial.

## Archivos a crear

```
veterinaria/
├── package.json
├── package-lock.json                 (generado por npm)
├── .gitignore
├── .prettierrc
├── .prettierignore
├── eslint.config.js
├── README.md
├── AGENTS.md                         (ya creado)
├── docs/modelo-de-datos.md           (ya copiado)
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── vitest.config.js
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── logger.js
│   │   │   └── db.js
│   │   ├── middlewares/
│   │   │   ├── errores.js
│   │   │   └── noEncontrado.js
│   │   ├── modulos/salud/rutas.js
│   │   └── utils/errores.js
│   └── tests/salud.test.js
└── frontend/
    ├── package.json
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx
        ├── rutas/rutas.jsx
        ├── paginas/Inicio.jsx
        ├── paginas/NoEncontrada.jsx
        ├── componentes/Layout.jsx
        ├── api/cliente.js
        ├── api/salud.js
        ├── utils/formato.js
        ├── utils/formato.test.js
        └── test/setup.js
```

## Dependencias exactas

**Raíz (dev):**
```
concurrently 10.0.7
eslint 10.14.0
@eslint/js 10.0.1
globals 17.14.0
eslint-plugin-react-hooks 7.1.1
eslint-plugin-react-refresh 0.5.7
eslint-config-prettier 10.1.8
prettier 3.9.10
```

**Backend:**
```
express 5.3.0
pg 8.23.1
zod 4.6.7
bcryptjs 3.0.3
jsonwebtoken 9.0.3
cookie-parser 1.4.7
helmet 8.3.0
cors 2.8.6
express-rate-limit 8.7.3
pino 10.4.0
pino-http 11.0.0
dotenv 18.0.9
```
**Backend (dev):**
```
node-pg-migrate 9.0.0
vitest 5.1.0
supertest 7.3.2
pino-pretty 13.2.0
```

**Frontend:**
```
react 19.3.1
react-dom 19.3.1
react-router-dom 7.18.5
@tanstack/react-query 5.107.1
react-hook-form 7.91.0
@hookform/resolvers 7.0.3
zod 4.6.7
```
**Frontend (dev):**
```
vite 8.3.6
@vitejs/plugin-react 6.2.1
tailwindcss 4.3.5
@tailwindcss/vite 4.3.5
vitest 5.1.0
jsdom 31.0.0
@testing-library/react 16.3.3
@testing-library/dom 10.4.2
@testing-library/jest-dom 7.0.1
@testing-library/user-event 14.6.8
```

## Decisiones de la fase 0

- Puertos: backend `3001`, frontend `5173`. Vite hace proxy de `/api` al
  backend, así el frontend usa rutas relativas y no hay que configurar CORS en
  desarrollo.
- `npm run dev` usa `concurrently` para levantar ambos workspaces.
- Backend en ESM (`"type": "module"`), `node --watch` en desarrollo (sin
  nodemon).
- Tailwind 4 con el plugin oficial `@tailwindcss/vite`; no hay
  `tailwind.config.js`, el tema va en `index.css` con `@theme`.
- ESLint flat config en la raíz, con globals de Node para backend y de browser
  para frontend.
- Prettier: comillas simples, punto y coma, ancho 100, comas finales.
- `/api/salud` responde `{ estado: "ok", hora }` sin depender de la base, para
  que la fase 0 funcione antes de crear las bases.
- El frontend de la fase 0 muestra una página de inicio sobria que consulta
  `/api/salud` con TanStack Query y muestra el estado de conexión.
- `README.md` inicial con requisitos, instalación en Windows, estructura y
  comandos.

**Listo cuando:** `npm run dev` levanta backend y frontend, el navegador muestra
la página de inicio y esta llama correctamente a `/api/salud`. Además
`npm run lint`, `npm run test` y `npm run build` pasan.

---

# Fase 1 · Base de datos, autenticación y permisos

**Objetivo:** todas las migraciones del modelo, seeds, login con cookie,
middlewares de rol/permiso, auditoría y administración de usuarios.

## Migraciones

`node-pg-migrate` con archivos SQL numerados y secciones
`-- Up Migration` / `-- Down Migration`.

| Archivo | Contenido |
|---|---|
| `001_extensiones_y_funciones.sql` | `pg_trgm`, `unaccent`, función `fn_sin_tildes()` inmutable |
| `002_usuarios_y_auditoria.sql` | `usuario`, `auditoria`, checks e índices |
| `003_catalogos.sql` | `especie`, `raza` |
| `004_clientes.sql` | `cliente`, índices de documento/teléfono y trigram |
| `005_pacientes.sql` | `paciente`, `paciente_dueno_historial`, secuencia de `codigo_interno` |
| `006_cola.sql` | `ingreso`, unique `(fecha_dia, numero_orden)`, índice `(fecha_dia, estado)` |
| `007_visitas.sql` | `visita`, `visita_version`, `visita_nota`, `medicacion` |
| `008_registros.sql` | `registro_vacuna`, `registro_antiparasitario`, `registro_estudio`, `registro_cirugia` |
| `009_controles.sql` | `control`, `aviso_control` |
| `010_adjuntos_y_configuracion.sql` | `archivo_adjunto`, `configuracion_franja_control`, FK de `paciente.foto_adjunto_id` |

Todas las tablas llevan `id bigint generated always as identity`, `creado_en`,
`creado_por`, `actualizado_en` y `actualizado_por`. Las listas cerradas usan
`text` + `CHECK`. Las FK usan `ON DELETE RESTRICT`.

## Backend

```
backend/
├── migrations/001...010.sql
├── scripts/
│   ├── crear-bases.js
│   ├── seed.js
│   ├── seed-demo.js
│   ├── backup.js
│   └── utilidades.js
├── src/
│   ├── config/permisos.js
│   ├── middlewares/
│   │   ├── autenticacion.js
│   │   ├── permisos.js
│   │   ├── validar.js
│   │   └── limitarLogin.js
│   ├── modulos/
│   │   ├── auth/{rutas,controlador,servicio,repositorio,esquemas}.js
│   │   ├── usuarios/{rutas,controlador,servicio,repositorio,esquemas}.js
│   │   └── auditoria/{rutas,controlador,servicio,repositorio,esquemas}.js
│   ├── utils/
│   │   ├── password.js
│   │   ├── jwt.js
│   │   ├── paginacion.js
│   │   └── transaccion.js
│   └── rutas.js
└── tests/
    ├── config/globalSetup.js
    ├── config/entorno.js
    ├── ayuda/base.js
    ├── autenticacion.test.js
    ├── permisos.test.js
    ├── usuarios.test.js
    └── auditoria.test.js
```

### Endpoints de la fase 1

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/usuarios` (admin, paginado)
- `GET /api/usuarios/:id` (admin)
- `POST /api/usuarios` (admin)
- `PUT /api/usuarios/:id` (admin)
- `PATCH /api/usuarios/:id/estado` (admin; activa/desactiva)
- `GET /api/auditoria` (admin, paginado y con filtros)

### Seguridad y permisos

- JWT en cookie `sesion_veterinaria`, `httpOnly`, `SameSite=Lax`, `Secure` en
  producción, 8 horas.
- `bcryptjs` con costo 12.
- Límite de login: 5 intentos fallidos por 15 minutos por IP + email.
- Límite general: 300 peticiones por 15 minutos por IP.
- Middleware `requiereAutenticacion`: valida el JWT y vuelve a cargar el usuario
  desde la base para verificar que siga `activo`.
- Middleware `requierePermiso(accion)`: consulta un mapa estático en
  `config/permisos.js`.
- El mapa de permisos ya incluye las acciones de las fases siguientes, para no
  rehacerlo después.
- Auditoría transaccional en crear, editar y desactivar usuarios, sin guardar
  `password_hash`.
- `GET /auth/me` devuelve usuario + permisos efectivos.
- Un admin no puede desactivarse a sí mismo ni dejar el sistema sin ningún
  admin activo.

### Seeds y scripts

- `npm run db:create`: crea `veterinaria_dev` y `veterinaria_test` si no existen.
- `npm run db:migrate`: corre migraciones en desarrollo.
- `npm run db:migrate:test`: corre migraciones en la base de test.
- `npm run db:rollback`: revierte la última migración.
- `npm run db:reset`: revierte todo y vuelve a migrar.
- `npm run seed`: admin inicial desde variables de entorno, especies, razas y
  franjas. Idempotente: si el admin ya existe, no le cambia la contraseña.
- `npm run seed:demo`: usuarios demo de veterinario y recepción, más clientes,
  pacientes, ingresos, visitas y controles ficticios. No usa datos reales.
- `npm run db:backup`: `pg_dump` a `backups/`, documentado en el README.

### Tests de la fase 1

- Login correcto, contraseña incorrecta, usuario inactivo, `/me` y logout.
- Cookie `httpOnly` y vencimiento de 8 horas.
- Límite de intentos de login.
- Recepción y veterinario reciben 403 en administración de usuarios y
  auditoría.
- Admin puede crear, editar y desactivar usuarios.
- Email duplicado devuelve 409.
- No se puede desactivar el último admin activo.
- Cada alta/edición/desactivación genera su fila de auditoría.
- El mapa de permisos impide que recepción edite visitas o vea datos clínicos.
- Un router de prueba con `requierePermiso("visitas.editar")` confirma 403 para
  recepción y 200 para veterinario/admin.
- Las migraciones suben y bajan sin errores en `veterinaria_test`.

## Frontend de la fase 1

```
frontend/src/
├── api/
│   ├── auth.js
│   ├── usuarios.js
│   └── auditoria.js
├── hooks/useSesion.js
├── componentes/
│   ├── RutaProtegida.jsx
│   ├── RutaAdmin.jsx
│   ├── Layout.jsx
│   ├── Modal.jsx
│   └── FormularioUsuario.jsx
├── paginas/
│   ├── Login.jsx
│   ├── Inicio.jsx
│   ├── Usuarios.jsx
│   ├── Auditoria.jsx
│   ├── NoAutorizado.jsx
│   └── NoEncontrada.jsx
└── utils/formato.js
```

- Rutas: `/login`, `/` (protegida), `/usuarios` (solo admin), `/auditoria`
  (solo admin), `/no-autorizado`, `*`.
- Sesión con TanStack Query (`["sesion"]`) contra `/auth/me`; el frontend nunca
  lee la cookie.
- Login con React Hook Form + Zod, etiquetas visibles, foco, estado de carga y
  error.
- Layout con barra superior y menú lateral según rol. La búsqueda global y los
  accesos rápidos se agregan en fases posteriores para no dejar controles
  muertos.
- Usuarios: tabla paginada, alta/edición en modal, activar/desactivar con
  confirmación.
- Auditoría: tabla paginada con filtros por entidad, acción, usuario y fechas;
  detalle de `antes`/`despues`.
- Formatos es-AR y documento enmascarado en listados.
- Tests de frontend: validación del login, error de credenciales y helpers de
  formato.

**Listo cuando:** las migraciones suben y bajan sin errores, se puede iniciar
sesión con admin, veterinario y recepción, y los tests de permisos pasan
(recepción no accede a lo clínico ni a administración).

---

# Decisiones y supuestos

1. **Versiones:** React 19, Express 5, Tailwind 4 y Vite 8. El prompt permite
   React 18 o superior; uso las últimas estables.
2. **Permisos:** mapa estático en código, no tabla de base. El modelo no define
   una tabla de permisos.
3. **Columnas de auditoría:** `creado_por` y `actualizado_por` quedan nullables
   (FK a `usuario`) para seeds y procesos sin sesión. `creado_en` y
   `actualizado_en` usan `now()`; `actualizado_en` se actualiza con un trigger.
4. **Anulación:** agrego `anulado`, `motivo_anulacion`, `anulado_por` y
   `anulado_en` a `visita`, `medicacion`, `registro_vacuna`,
   `registro_antiparasitario`, `registro_estudio`, `registro_cirugia`, `control`,
   `aviso_control` y `archivo_adjunto`.
5. **Sin anulación** en `ingreso` (se usa `estado = cancelado`), `cliente` (se
   fusiona), `paciente` (deceso/fusión), `visita_version` y `visita_nota` (son
   inmutables).
6. **`codigo_interno`:** secuencia de base y formato `PAC-000001`.
7. **`ficha_incompleta`:** columna booleana mantenida por la aplicación, no
   columna generada.
8. **Búsqueda:** `fn_sin_tildes()` inmutable + índices GIN trigram sobre
   nombre/apellido de cliente y nombre de paciente.
9. **`nro_documento`:** índice común, no único. El aviso de duplicado se
   implementa en la fase 2.
10. **Email de usuario:** se guarda en minúsculas y tiene índice único sobre
    `lower(email)`.
11. **`peso_kg`:** `numeric(6,2)`; **`temperatura_c`:** `numeric(4,1)`.
12. **Franjas:** `hora_desde` y `hora_hasta` como `time`, no `timestamptz`.
13. **Foto del paciente:** `foto_adjunto_id` se agrega en la migración 010
    porque `archivo_adjunto` referencia a `paciente`.
14. **`registro_cirugia`:** mantengo `visita_id` (común a todos los registros) y
    `visita_origen_id` (como pide el modelo). Si preferís unificarlos, lo cambio.
15. **`chip_codigo`:** queda como texto libre; el modelo dice que la longitud de
    15 dígitos está “a confirmar”.
16. **Down migrations:** se eliminan tablas en orden inverso; no se eliminan las
    extensiones `pg_trgm` ni `unaccent` porque pueden ser compartidas.
17. **Tests:** usan `veterinaria_test`, corren las migraciones una vez en
    `globalSetup` y truncan las tablas entre casos.
18. **Demo:** los datos ficticios usan nombres del tipo “Cliente Demo A” /
    “Paciente Demo Alfa”, nunca datos reales.
19. **Admin inicial:** si ya existe, `seed` no le cambia la contraseña.
20. **CSRF:** en la fase 1 no agrego token CSRF; la cookie es `SameSite=Lax` y
    CORS está restringido. Lo revisamos en la fase 7.

---

# Preguntas pendientes

1. **Anulación:** ¿está bien la lista del punto 4 y dejar afuera `ingreso`,
   `cliente`, `paciente`, `visita_version` y `visita_nota`?
2. **Cirugías:** ¿dejo `visita_id` y `visita_origen_id` como pide el modelo, o
   unifico todo en `visita_origen_id`?
3. **Recepción y visitas:** el modelo solo le oculta anamnesis y medicación.
   ¿Puede ver motivo, diagnóstico y observaciones? Esto define el permiso
   `visitas.ver_clinico` para la fase 4.
4. **Razas iniciales:** ¿mestizo y otra para canino/felino, y solo “otra” para
   ave, roedor, reptil y otro? ¿O querés otra lista?
5. **Auditoría:** ¿`creado_por`/`actualizado_por` nullables está bien, o preferís
   un usuario “sistema” y columnas `NOT NULL`?
6. **Chip:** ¿dejo `chip_codigo` libre por ahora o lo limito a 15 dígitos?
7. **Usuarios demo:** ¿ok crear `demo.veterinario@example.com` y
   `demo.recepcion@example.com` con contraseña tomada de
   `SEED_DEMO_PASSWORD`?
8. **Stack:** ¿confirmás React 19 + Express 5 + Tailwind 4 + Vite 8?

Quedo esperando la aprobación para empezar a escribir código.
