# Sistema de gestión veterinaria

Sistema web para una veterinaria pequeña: cola de espera diaria, urgencias, visitas
clínicas, controles y avisos manuales. Este repositorio está en la **fase 0**:
base del monorepo, backend con endpoint de salud y frontend que lo consume.

La fuente de verdad del dominio es [`docs/modelo-de-datos.md`](docs/modelo-de-datos.md).

## Requisitos

- Node.js 22.12 o superior (probado con Node 24).
- npm 10 o superior.
- PostgreSQL 14 o superior (se usa a partir de la fase 1).
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

   En la fase 0 el backend funciona con los valores por defecto, sin tocar la
   base de datos. En la fase 1 vas a completar `DATABASE_URL`,
   `TEST_DATABASE_URL` y `JWT_SECRET` en `backend\.env`.

## Desarrollo

```powershell
npm run dev
```

Eso levanta:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

El frontend hace proxy de `/api` al backend, así que no hace falta configurar
CORS en desarrollo. Abrí `http://localhost:5173`: la página de inicio muestra el
estado de `GET /api/salud`.

### Probar el endpoint de salud

```powershell
Invoke-RestMethod http://localhost:3001/api/salud
```

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

## Estructura

```
veterinaria/
├── AGENTS.md              Mapa permanente para agentes y colaboradores
├── docs/
│   ├── modelo-de-datos.md Fuente de verdad del dominio
│   └── plan-fase-0-1.md   Plan aprobado de las primeras fases
├── backend/
│   ├── src/
│   │   ├── app.js         Configuración de Express
│   │   ├── server.js      Arranque del servidor
│   │   ├── config/        Entorno, logger y conexión a PostgreSQL
│   │   ├── middlewares/   Errores y rutas no encontradas
│   │   ├── modulos/       Módulos por dominio (salud, auth, usuarios, ...)
│   │   └── utils/
│   └── tests/
└── frontend/
    └── src/
        ├── api/           Cliente HTTP y hooks de TanStack Query
        ├── componentes/   Layout y componentes reutilizables
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
| `DATABASE_URL` | Conexión a `veterinaria_dev` (fase 1) |
| `TEST_DATABASE_URL` | Conexión a `veterinaria_test` (fase 1) |
| `JWT_SECRET` | Secreto para firmar la sesión (fase 1) |
| `ADMIN_*` | Credenciales del admin inicial del seed (fase 1) |
| `SEED_DEMO_PASSWORD` | Contraseña de los usuarios demo (fase 1) |

`.env` está en `.gitignore`; nunca se commitea.

## Estado de las fases

- [x] **Fase 0:** monorepo, backend con `/api/salud`, frontend con inicio,
      ESLint, Prettier, tests y README.
- [ ] **Fase 1:** migraciones, seeds, autenticación, permisos y auditoría.
- [ ] Fases 2 a 7: ver `docs/plan-fase-0-1.md` y el prompt inicial.

## Próximos pasos (fase 1)

- Crear las bases `veterinaria_dev` y `veterinaria_test`.
- Correr migraciones y seeds.
- Iniciar sesión con cookie y administrar usuarios según rol.

Los detalles están en [`docs/plan-fase-0-1.md`](docs/plan-fase-0-1.md).
