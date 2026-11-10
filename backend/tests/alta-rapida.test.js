import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { hoyEnTucuman } from '../src/utils/fechas.js';
import {
  contarAuditoria,
  crearAgente,
  crearUsuario,
  iniciarSesion,
  limpiarBase,
} from './ayuda/base.js';

function datosAltaRapida(extra = {}) {
  return {
    nombre: 'Urgencia',
    apellido: 'Demo',
    tipoDocumento: 'DNI',
    nroDocumento: '90000200',
    servicio: 'atencion_clinica',
    urgencia: 'posible',
    comentario: 'Llegó con urgencia, datos inventados.',
    ...extra,
  };
}

describe('alta rápida de urgencias', () => {
  let agenteRecepcion;
  let agenteVet;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({
      email: 'recepcion@example.com',
      rol: 'recepcion',
      nombreCompleto: 'Recepción Prueba',
    });
    await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Vet Prueba',
    });

    await obtenerPool().query(`INSERT INTO especie (nombre) VALUES ('canino'), ('otro')`);

    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('crea cliente, paciente provisorio e ingreso urgente en una sola operación', async () => {
    const respuesta = await agenteRecepcion.post('/api/cola/alta-rapida').send(datosAltaRapida());

    expect(respuesta.status).toBe(201);

    const { cliente, paciente, ingreso } = respuesta.body;

    expect(cliente.altaRapida).toBe(true);
    expect(cliente.fichaIncompleta).toBe(true);
    expect(cliente.telefonoPrincipal).toBeNull();
    expect(cliente.nroDocumento).toBe('90000200');

    expect(paciente.nombre).toBe('Sin nombre');
    expect(paciente.provisorio).toBe(true);
    expect(paciente.fichaIncompleta).toBe(true);
    expect(paciente.especieNombre).toBe('otro');
    expect(paciente.clienteId).toBe(cliente.id);

    expect(ingreso.pacienteId).toBe(paciente.id);
    expect(ingreso.fechaDia).toBe(hoyEnTucuman());
    expect(ingreso.urgenciaEstado).toBe('posible');
    expect(ingreso.prioridad).toBe('urgente');
    expect(ingreso.estado).toBe('esperando');

    expect(await contarAuditoria('cliente', cliente.id, 'crear')).toBe(1);
    expect(await contarAuditoria('paciente', paciente.id, 'crear')).toBe(1);
    expect(await contarAuditoria('ingreso', ingreso.id, 'crear')).toBe(1);
  });

  it('avisa por documento duplicado y permite confirmar el alta igual', async () => {
    const aviso = await agenteRecepcion
      .post('/api/cola/alta-rapida')
      .send(datosAltaRapida({ apellido: 'Duplicado' }));

    expect(aviso.status).toBe(409);
    expect(aviso.body.error.codigo).toBe('CLIENTE_DUPLICADO');
    expect(aviso.body.error.detalles[0].candidatos).toHaveLength(1);
    expect(aviso.body.error.detalles[0].candidatos[0].nroDocumento).toMatch(
      /^\*\*\*\.\*\*\*\.\d{3}$/,
    );

    const confirmado = await agenteRecepcion
      .post('/api/cola/alta-rapida')
      .send(datosAltaRapida({ apellido: 'Duplicado', confirmarDuplicado: true }));

    expect(confirmado.status).toBe(201);
    expect(confirmado.body.cliente.apellido).toBe('Duplicado');
  });

  it('recepción no puede crear un alta rápida con urgencia confirmada', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/cola/alta-rapida')
      .send(datosAltaRapida({ nroDocumento: '90000201', urgencia: 'confirmada' }));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
  });

  it('el veterinario puede crear un alta rápida con urgencia confirmada', async () => {
    const respuesta = await agenteVet
      .post('/api/cola/alta-rapida')
      .send(datosAltaRapida({ nroDocumento: '90000202', urgencia: 'confirmada' }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ingreso.urgenciaEstado).toBe('confirmada');
    expect(respuesta.body.ingreso.urgenciaConfirmadaPor).toBeTruthy();
    expect(respuesta.body.ingreso.urgenciaConfirmadaEn).toBeTruthy();
  });
});
