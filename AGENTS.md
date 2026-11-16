# AGENTS.md · Sistema de gestión veterinaria

Mapa breve del proyecto para agentes y colaboradores. La fuente de verdad del
dominio es `docs/modelo-de-datos.md`; si algo no coincide, gana el modelo y se
consulta antes de inventar requisitos.

## Stack

- **Frontend:** React 19 + Vite (JavaScript, ESM), Tailwind CSS, React Router,
  TanStack Query, React Hook Form y Zod.
- **Backend:** Node.js LTS + Express (JavaScript, ESM), `pg` con SQL
  parametrizado (sin ORM), Zod, `bcryptjs`, `jsonwebtoken`, `cookie-parser`,
  `helmet`, `cors`, `express-rate-limit` y `pino`.
- **Base de datos:** PostgreSQL. Bases `veterinaria_dev` y `veterinaria_test`.
  Fechas en `timestamptz` (UTC), snapshots en `jsonb`, extensiones `pg_trgm` y
  `unaccent`.
- **Migraciones:** `node-pg-migrate` con archivos SQL numerados.
- **Calidad:** Vitest, Supertest, ESLint y Prettier.
- **Paquetes:** npm con workspaces (`backend`, `frontend`).

## Estructura

```
backend/
  migrations/        SQL numerado (una migración por grupo de tablas)
  scripts/           seed, seed:demo, backup
  src/
    config/          entorno, conexión, logger, permisos
    middlewares/     autenticación, permisos, validación, errores
    modulos/         auth, usuarios, clientes, pacientes, cola, visitas,
                     registros, controles, adjuntos, auditoria
    utils/
  tests/
frontend/
  src/
    api/             cliente HTTP y hooks de TanStack Query
    componentes/
    paginas/
    rutas/
    utils/
```

Cada módulo del backend se separa en rutas, controlador, servicio y repositorio.
La lógica de negocio vive en el servicio, nunca en las rutas.

## Convenciones

- Dominio en español (`crearCliente`, `confirmarUrgencia`, tablas y columnas en
  `snake_case`). Términos técnicos estándar quedan en inglés (middleware,
  controller, hook).
- Código simple y legible antes que ingenioso. Comentarios breves que expliquen
  el **por qué** de lo no obvio.
- Commits chicos y frecuentes, en español: `feat:`, `fix:`, `docs:`, `test:`,
  `chore:`.
- Nada de datos reales de personas ni animales, ni en seeds, ni en tests, ni en
  ejemplos.
- Windows + PowerShell + VS Code: los scripts de npm tienen que funcionar en
  Windows (sin sintaxis exclusiva de bash).
- Formato es-AR en la interfaz: `dd/mm/aaaa`, 24 horas, hora de Tucumán
  (UTC-3).

## Reglas de dominio que no se rompen

1. Búsqueda previa por documento o teléfono antes de crear un cliente.
2. Alta rápida solo con un ingreso marcado como urgencia posible o confirmada;
   crea cliente `alta_rapida` + `ficha_incompleta` y paciente provisorio.
3. Ficha completa = teléfono principal. Se recuerda al cerrar la visita.
4. Urgencia: recepción marca, veterinario confirma o descarta. La hora de
   llegada nunca se modifica.
5. Cola diaria con numeración que reinicia cada día; al terminar el día lo que
   quedó abierto pasa a `sin_cerrar`.
6. Visita: borrador libre; al cerrar exige motivo; cada edición posterior exige
   motivo y genera una versión; lo agregado después es una nota con fecha.
7. Control: nace de una visita; vencido pasa a `ausente`; reprogramar crea otro
   y deja el original como `reprogramado`.
8. Unión de clientes duplicados: solo admin; reasigna pacientes, visitas y
   registros, y marca `fusionado_en_cliente_id`.
9. Nada clínico se borra: se anula con `anulado`, `motivo_anulacion`,
   `anulado_por` y `anulado_en`.
10. Recepción puede leer la historia clínica completa, pero solo veterinarios y
    admin crean, editan o anulan lo clínico. La entrega de la historia a un
    titular se audita con la acción `exportar`.

## Seguridad

- SQL **siempre** parametrizado; nunca concatenar valores.
- El backend es la única autoridad. Ocultar botones en el frontend es solo
  comodidad.
- Sesión con JWT en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción,
  8 horas. Contraseñas con `bcryptjs` (costo 12).
- Auditar crear, editar, anular y unir (usuario, fecha, antes y después).
- No registrar datos personales ni contraseñas en logs. Documento enmascarado
  en listados.
- Secretos en `.env`; `.env` fuera de git. Adjuntos fuera de la carpeta pública,
  solo con sesión válida.
- Permisos por rol centralizados en `backend/src/config/permisos.js`; el
  middleware `requierePermiso(accion)` consulta ese mapa.

## Flujo de trabajo

- Planificar antes de escribir código y esperar aprobación.
- Trabajar por fases (sección 12 del prompt inicial). Al terminar cada fase:
  correr tests, resumir cambios, supuestos y decisiones, y esperar OK.
- Si algo es ambiguo o contradice el modelo, preguntar. Proponer cambios al
  modelo antes de aplicarlos.
- Tests de las reglas críticas; no hace falta cobertura total.
- `npm run dev` levanta backend y frontend juntos.

## Comandos

```
npm install
npm run dev
npm run lint
npm run format
npm run test
npm run db:migrate
npm run db:rollback
npm run seed
npm run seed:demo
npm run db:backup
```

Los detalles de instalación en Windows, variables de entorno y restauración de
backups están en `README.md`.
