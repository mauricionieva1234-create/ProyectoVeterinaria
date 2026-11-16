import { registrarAuditoria } from '../auditoria/repositorio.js';
import { listarAdjuntos } from '../adjuntos/servicio.js';
import { aAvisoPublico, aControlPublico } from '../controles/servicio.js';
import { listarAvisosDePaciente, listarControlesDePaciente } from '../controles/repositorio.js';
import { obtenerPaciente } from '../pacientes/servicio.js';
import { listarPorPaciente } from '../registros/servicio.js';
import { aMedicacionPublica, aNotaPublica, aVisitaPublica } from '../visitas/servicio.js';
import {
  listarMedicacionDePaciente,
  listarNotasDePaciente,
  listarVisitasDePaciente,
} from '../visitas/repositorio.js';

// Agrupa filas por el id de la visita para mostrarlas dentro de cada visita.
function agruparPorVisita(filas) {
  const grupos = new Map();

  for (const fila of filas) {
    const clave = String(fila.visita_id);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(fila);
  }

  return grupos;
}

// Historia clínica completa de un paciente en modo lectura. Incluye solo los
// datos vigentes (lo anulado sigue guardado y auditado, pero no se imprime).
export async function obtenerHistoriaClinica(pacienteId) {
  const [paciente, visitas, medicacion, notas, registros, controles, avisos, adjuntos] =
    await Promise.all([
      obtenerPaciente(pacienteId),
      listarVisitasDePaciente(pacienteId),
      listarMedicacionDePaciente(pacienteId),
      listarNotasDePaciente(pacienteId),
      listarPorPaciente(pacienteId),
      listarControlesDePaciente(pacienteId),
      listarAvisosDePaciente(pacienteId),
      listarAdjuntos({ pacienteId }),
    ]);

  const medicacionPorVisita = agruparPorVisita(medicacion);
  const notasPorVisita = agruparPorVisita(notas);
  const avisosPorControl = new Map();

  for (const aviso of avisos) {
    const clave = String(aviso.control_id);
    if (!avisosPorControl.has(clave)) avisosPorControl.set(clave, []);
    avisosPorControl.get(clave).push(aviso);
  }

  return {
    paciente,
    visitas: visitas.map((fila) => ({
      ...aVisitaPublica(fila),
      medicacion: (medicacionPorVisita.get(String(fila.id)) ?? []).map(aMedicacionPublica),
      notas: (notasPorVisita.get(String(fila.id)) ?? []).map(aNotaPublica),
    })),
    registros,
    controles: controles.map((fila) => ({
      ...aControlPublico(fila),
      avisos: (avisosPorControl.get(String(fila.id)) ?? []).map(aAvisoPublico),
    })),
    adjuntos,
    generadoEn: new Date().toISOString(),
  };
}

// Registra la entrega al titular. No modifica ningún dato clínico: solo deja
// constancia de quién exportó, a quién se entregó y cuándo.
export async function exportarHistoriaClinica(pacienteId, datos, ejecutor) {
  const historia = await obtenerHistoriaClinica(pacienteId);

  await registrarAuditoria({
    usuarioId: ejecutor.id,
    entidad: 'paciente',
    entidadId: Number(pacienteId),
    accion: 'exportar',
    despues: {
      entregadoA: datos.entregadoA,
      documentoVerificado: true,
      generadoEn: historia.generadoEn,
    },
  });

  return historia;
}
