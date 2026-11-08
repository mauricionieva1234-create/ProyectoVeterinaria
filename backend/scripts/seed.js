import { pathToFileURL } from 'node:url';
import { env } from '../src/config/env.js';
import { hashearPassword } from '../src/utils/password.js';
import {
  cerrarPool,
  insertarEspecie,
  insertarFranja,
  insertarRaza,
  obtenerPool,
} from './utilidades.js';

const ESPECIES = ['canino', 'felino', 'ave', 'roedor', 'reptil', 'otro'];

const RAZAS_POR_ESPECIE = {
  canino: ['Mestizo', 'Otra'],
  felino: ['Mestizo', 'Otra'],
  ave: ['Otra'],
  roedor: ['Otra'],
  reptil: ['Otra'],
  otro: ['Otra'],
};

const FRANJAS = [
  { nombre: 'manana', desde: '09:00', hasta: '12:00' },
  { nombre: 'tarde', desde: '17:00', hasta: '20:00' },
];

export async function ejecutarSeed() {
  const cliente = await obtenerPool().connect();

  try {
    await cliente.query('BEGIN');

    for (const nombre of ESPECIES) {
      await insertarEspecie(cliente, nombre);
    }

    for (const [especie, razas] of Object.entries(RAZAS_POR_ESPECIE)) {
      const { rows } = await cliente.query(
        'SELECT id FROM especie WHERE lower(nombre) = lower($1)',
        [especie],
      );

      for (const raza of razas) {
        await insertarRaza(cliente, rows[0].id, raza);
      }
    }

    for (const franja of FRANJAS) {
      await insertarFranja(cliente, franja.nombre, franja.desde, franja.hasta);
    }

    const adminEmail = (env.ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
    const adminNombre = env.ADMIN_NOMBRE ?? 'Administrador';

    const { rowCount } = await cliente.query(
      'SELECT 1 FROM usuario WHERE lower(email) = lower($1)',
      [adminEmail],
    );

    if (rowCount === 0) {
      if (!env.ADMIN_PASSWORD) {
        throw new Error('Falta ADMIN_PASSWORD en backend/.env para crear el admin inicial');
      }

      const passwordHash = await hashearPassword(env.ADMIN_PASSWORD);

      await cliente.query(
        `INSERT INTO usuario (nombre_completo, email, password_hash, rol, activo)
         VALUES ($1, $2, $3, 'admin', true)`,
        [adminNombre, adminEmail, passwordHash],
      );

      console.log(`Admin creado: ${adminEmail}`);
    } else {
      // Idempotente: si ya existe, no se toca la contraseña.
      console.log(`Admin ya existente: ${adminEmail} (sin cambios)`);
    }

    await cliente.query('COMMIT');
    console.log('Seed base completado: especies, razas, franjas y admin.');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await ejecutarSeed();
  } catch (error) {
    console.error('No se pudo ejecutar el seed:', error.message);
    process.exitCode = 1;
  } finally {
    await cerrarPool();
  }
}
