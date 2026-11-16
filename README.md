# Sistema de gestión veterinaria

Sistema web para una veterinaria pequeña: cola de espera diaria, urgencias, visitas
clínicas, controles y avisos manuales. La **etapa 1** incluye la base de datos,
las migraciones, los seeds, el inicio de sesión con cookie, los permisos por rol,
la auditoría, la administración de usuarios, clientes, pacientes, cola, visitas,
registros clínicos, historia clínica completa y un asistente local de consultas.

La fuente de verdad del dominio es [`docs/modelo-de-datos.md`](docs/modelo-de-datos.md).

## Requisitos

- Node.js 22.12 o superior (probado con Node 24).
- npm 10 o superior.
- PostgreSQL 14 o superior con `psql`, `pg_dump` y `pg_restore` en el `PATH`.
- Windows con PowerShell y VS Code.

## Instalación en Windows

1. Cloná o abrí la carpeta del proyecto:

   ```powershell
   cd "C:\PRYECTOS - TUP\veterinaria"
   ```

2. Instalá las dependencias de todos los workspaces:

   ```powershell
   npm install
   ```

3. Copiá el archivo de variables de entorno del backend:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```

4. Completá `backend\.env`:

   - `DATABASE_URL`: conexión a `veterinaria_dev`.
   - `TEST_DATABASE_URL`: conexión a `veterinaria_test` (obligatoria para los tests).
   - `JWT_SECRET`: un texto aleatorio de 32 caracteres o más.
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NOMBRE`: administrador inicial.
   - `SEED_DEMO_PASSWORD`: contraseña de los usuarios de demostración.

   Ejemplo de conexión local:

   ```env
   DATABASE_URL=postgres://postgres:TU_CLAVE@localhost:5432/veterinaria_dev
   TEST_DATABASE_URL=postgres://postgres:TU_CLAVE@localhost:5432/veterinaria_test
   JWT_SECRET=un-secreto-largo-de-32-caracteres-o-mas
   ```

5. Creá las bases, aplicá las migraciones y cargá los datos iniciales:

   ```powershell
   npm run db:create
   npm run db:migrate
   npm run db:migrate:test
   npm run seed
   ```

   `npm run seed:demo` agrega además clientes, pacientes, un ingreso, una visita,
   un control y los usuarios de demostración. Todos los datos son ficticios.

## Desarrollo

```powershell
npm run dev
```

Eso levanta:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

El frontend hace proxy de `/api` al backend, así que no hace falta configurar
CORS en desarrollo. Abrí `http://localhost:5173`: si no hay sesión te redirige
al login. La página de inicio muestra el estado de `GET /api/salud`.

### Probar el endpoint de salud

```powershell
Invoke-RestMethod http://localhost:3001/api/salud
```

## Usuarios

El seed base crea el administrador definido por `ADMIN_NOMBRE`, `ADMIN_EMAIL` y
`ADMIN_PASSWORD`. Es idempotente: si el email ya existe, no cambia la contraseña.

`npm run seed:demo` crea estos usuarios ficticios con la contraseña indicada en
`SEED_DEMO_PASSWORD`:

| Email | Rol |
|---|---|
| `demo.veterinario@example.com` | veterinario |
| `demo.recepcion@example.com` | recepcion |

## Roles y permisos

- **Administrador:** todo, incluida la administración de usuarios y la auditoría.
- **Veterinario:** datos administrativos y todo lo clínico (visitas, medicación,
  registros, controles y adjuntos).
- **Recepción:** clientes, pacientes, cola, controles, avisos y adjuntos. Puede
  leer la historia clínica completa y usar el asistente, pero no crear, editar ni
  anular datos clínicos.

El mapa de permisos vive en `backend/src/config/permisos.js`. El backend es la
única autoridad; el frontend solo oculta opciones para comodidad.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta backend y frontend juntos |
| `npm run dev:backend` | Levanta solo el backend |
| `npm run dev:frontend` | Levanta solo el frontend |
| `npm run build` | Compila el frontend |
| `npm run lint` | Corre ESLint sobre todo el monorepo |
| `npm run format` | Formatea con Prettier |
| `npm run format:check` | Verifica el formato sin modificar archivos |
| `npm test` | Corre los tests de backend y frontend |
| `npm run test:backend` | Corre solo los tests del backend |
| `npm run test:frontend` | Corre solo los tests del frontend |
| `npm run db:create` | Crea `veterinaria_dev` y `veterinaria_test` si no existen |
| `npm run db:migrate` | Aplica las migraciones en desarrollo |
| `npm run db:migrate:test` | Aplica las migraciones en la base de test |
| `npm run db:rollback` | Revierte la última migración de desarrollo |
| `npm run db:reset` | Revierte todo y vuelve a migrar desarrollo |
| `npm run seed` | Carga especies, razas, franjas y el admin inicial |
| `npm run seed:demo` | Carga datos ficticios de demostración |
| `npm run db:backup` | Genera un backup comprimido en `backend/backups/` |

Los tests del backend usan `veterinaria_test`, aplican las migraciones una vez y
truncan las tablas entre archivos. Nunca tocan `veterinaria_dev`.

## Backup y restauración

Generar un backup (formato custom de PostgreSQL):

```powershell
npm run db:backup
```

Restaurar un backup sobre `veterinaria_dev`:

```powershell
$env:PGPASSWORD = "TU_CLAVE"
pg_restore --clean --if-exists --no-owner `
  --host=localhost --port=5432 --username=postgres `
  --dbname=veterinaria_dev `
  backend\backups\veterinaria-AAAA-MM-DD....dump
Remove-Item Env:\PGPASSWORD
```

La restauración borra y vuelve a crear los objetos de la base indicada. Hacelo
con el backend detenido y verificá el nombre de la base antes de ejecutarlo.

## Estructura

```
veterinaria/
├── AGENTS.md              Mapa permanente para agentes y colaboradores
├── docs/
│   ├── modelo-de-datos.md Fuente de verdad del dominio
│   └── plan-fase-0-1.md   Plan aprobado de las primeras fases
├── backend/
│   ├── migrations/        SQL numerado de node-pg-migrate
│   ├── scripts/           Creación de bases, migraciones, seeds y backup
│   ├── src/
│   │   ├── app.js         Configuración de Express
│   │   ├── server.js      Arranque del servidor
│   │   ├── config/        Entorno, conexión, logger y permisos
│   │   ├── middlewares/   Autenticación, permisos, validación y errores
│   │   ├── modulos/       Módulos por dominio (salud, auth, usuarios, ...)
│   │   └── utils/         Contraseñas, JWT, paginación y transacciones
│   └── tests/
└── frontend/
    └── src/
        ├── api/           Cliente HTTP y hooks de TanStack Query
        ├── componentes/   Layout, guardas y componentes reutilizables
        ├── hooks/         Sesión y mutaciones de autenticación
        ├── paginas/       Pantallas
        ├── rutas/         Definición de rutas
        └── utils/         Formatos es-AR y helpers
```

## Variables de entorno

Están documentadas en [`backend/.env.example`](backend/.env.example). Las
principales:

| Variable | Para qué |
|---|---|
| `PORT` | Puerto del backend (3001 por defecto) |
| `CORS_ORIGEN` | Origen permitido del frontend |
| `LOG_LEVEL` | Nivel de logs de pino |
| `DATABASE_URL` | Conexión a `veterinaria_dev` |
| `TEST_DATABASE_URL` | Conexión a `veterinaria_test` |
| `JWT_SECRET` | Secreto para firmar la sesión (32 caracteres o más) |
| `ADMIN_*` | Credenciales del admin inicial del seed |
| `SEED_DEMO_PASSWORD` | Contraseña de los usuarios demo |
| `ZONA_HORARIA` | Zona usada para mostrar fechas (`America/Argentina/Tucuman`) |

`.env` está en `.gitignore`; nunca se commitea.

## Seguridad

- Contraseñas con `bcryptjs` (costo 12).
- Sesión con JWT en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción y
  8 horas de duración.
- Límite de 5 intentos fallidos de login por IP + email cada 15 minutos.
- SQL siempre parametrizado.
- Auditoría de crear, editar, anular y unir, con usuario, fecha y antes/después.
- El documento se enmascara en los listados y no se registran datos personales
  en los logs.

## Estado de las fases

- [x] **Fase 0:** monorepo, backend con `/api/salud`, frontend con inicio,
      ESLint, Prettier, tests y README.
- [x] **Fase 1:** migraciones, seeds, autenticación con cookie, permisos por rol,
      auditoría y administración de usuarios.
- [x] **Fase 2:** catálogos, clientes y pacientes.
- [x] **Fase 3:** cola diaria, urgencias y alta rápida.
- [x] **Fase 4:** visitas, registros clínicos, controles, avisos y adjuntos.
- [x] **Historia clínica completa:** lectura, impresión y exportación auditada.
- [x] **Asistente local:** consultas por reglas, con sesión y en solo lectura.
- [ ] **Próximas etapas:** definir alcance con el equipo (cobros, reportes u otras
      mejoras).

Los detalles de las próximas fases están en
[`docs/plan-fase-0-1.md`](docs/plan-fase-0-1.md).
