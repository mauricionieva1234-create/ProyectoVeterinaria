import request from 'supertest';
import { crearApp } from '../../src/app.js';
import { obtenerPool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { hashearPassword } from '../../src/utils/password.js';

export const PASSWORD_PRUEBA = 'ClaveSegura123';

function verificarBaseDeTest() {
  if (env.NODE_ENV !== 'test') {
    throw new Error('Los helpers de test solo se pueden usar con NODE_ENV=test');
  }

  const nombre = new URL(env.TEST_DATABASE_URL).pathname.replace(/^\//, '');

  if (!nombre.includes('test')) {
    throw new Error('Por seguridad, solo se limpian bases cuyo nombre contenga "test"');
  }
}

// Borra todas las tablas y reinicia las identidades. Las migraciones quedan
// aplicadas porque pgmigrations se excluye.
export async function limpiarBase() {
  verificarBaseDeTest();

  await obtenerPool().query(`
    DO $$
    DECLARE tabla record;
    BEGIN
      FOR tabla IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> 'pgmigrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', tabla.tablename);
      END LOOP;
    END $$;
  `);

  await obtenerPool().query('ALTER SEQUENCE IF EXISTS paciente_codigo_interno_seq RESTART WITH 1');
}

export function crearAgente() {
  return request.agent(crearApp());
}

export async function crearUsuario({
  email,
  password = PASSWORD_PRUEBA,
  rol = 'veterinario',
  activo = true,
  nombreCompleto = 'Usuario de Prueba',
  matricula = null,
}) {
  const passwordHash = await hashearPassword(password);

  const { rows } = await obtenerPool().query(
    `INSERT INTO usuario (nombre_completo, email, password_hash, rol, matricula, activo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nombre_completo, email, rol, matricula, activo`,
    [nombreCompleto, email, passwordHash, rol, matricula, activo],
  );

  return rows[0];
}

export function iniciarSesion(agente, email, password = PASSWORD_PRUEBA) {
  return agente.post('/api/auth/login').send({ email, password });
}

export function extraerCookie(respuesta) {
  const cookie = respuesta.headers['set-cookie']?.[0];
  return cookie ? cookie.split(';')[0] : '';
}

export async function contarAuditoria(entidad, entidadId) {
  const { rows } = await obtenerPool().query(
    'SELECT count(*)::int AS total FROM auditoria WHERE entidad = $1 AND entidad_id = $2',
    [entidad, entidadId],
  );
  return rows[0].total;
}
