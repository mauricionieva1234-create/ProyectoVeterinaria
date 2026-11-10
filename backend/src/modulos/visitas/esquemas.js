import { z } from 'zod';

const textoOpcional = (max, mensaje) => z.string().trim().max(max, mensaje).nullable().optional();

const numeroOpcional = (min, max, mensaje) =>
  z.preprocess((valor) => {
    if (valor === '' || valor === undefined) return undefined;
    if (valor === null) return null;
    return Number(valor);
  }, z.number().min(min, mensaje).max(max, mensaje).nullable().optional());

const enteroOpcional = (min, max, mensaje) =>
  z.preprocess((valor) => {
    if (valor === '' || valor === undefined) return undefined;
    if (valor === null) return null;
    return Number(valor);
  }, z.number().int().min(min, mensaje).max(max, mensaje).nullable().optional());

const idOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined) return undefined;
  if (valor === null) return null;
  return Number(valor);
}, z.number().int().positive().nullable().optional());

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato aaaa-mm-dd');

const motivo = z
  .string()
  .trim()
  .min(3, 'El motivo debe tener al menos 3 caracteres')
  .max(2000, 'El motivo es demasiado largo');

export const esquemaCrearVisita = z.object({
  pacienteId: z.coerce.number().int().positive(),
  ingresoId: idOpcional,
  motivoConsulta: textoOpcional(5000, 'El motivo de consulta es demasiado largo'),
  anamnesis: textoOpcional(10000, 'La anamnesis es demasiado larga'),
  temperaturaC: numeroOpcional(20, 50, 'La temperatura debe estar entre 20 y 50 °C'),
  pesoKg: numeroOpcional(0.01, 9999.99, 'El peso debe ser mayor que cero'),
  diagnostico: textoOpcional(10000, 'El diagnóstico es demasiado largo'),
  observaciones: textoOpcional(10000, 'Las observaciones son demasiado largas'),
  // Solo se usan cuando el paciente es provisorio.
  especieId: idOpcional,
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre no puede quedar vacío')
    .max(120, 'El nombre es demasiado largo')
    .nullable()
    .optional(),
});

export const esquemaActualizarVisita = z
  .object({
    motivoConsulta: textoOpcional(5000, 'El motivo de consulta es demasiado largo'),
    anamnesis: textoOpcional(10000, 'La anamnesis es demasiado larga'),
    temperaturaC: numeroOpcional(20, 50, 'La temperatura debe estar entre 20 y 50 °C'),
    pesoKg: numeroOpcional(0.01, 9999.99, 'El peso debe ser mayor que cero'),
    diagnostico: textoOpcional(10000, 'El diagnóstico es demasiado largo'),
    observaciones: textoOpcional(10000, 'Las observaciones son demasiado largas'),
    motivoCambio: z
      .string()
      .trim()
      .min(3, 'El motivo del cambio debe tener al menos 3 caracteres')
      .max(2000, 'El motivo del cambio es demasiado largo')
      .optional(),
  })
  .refine((datos) => Object.keys(datos).some((campo) => campo !== 'motivoCambio'), {
    message: 'No hay cambios para guardar',
  });

export const esquemaCerrarVisita = z.object({
  motivoConsulta: z
    .string()
    .trim()
    .min(3, 'El motivo de consulta es obligatorio para cerrar la visita')
    .max(5000, 'El motivo de consulta es demasiado largo'),
});

export const esquemaNotaVisita = z.object({
  texto: z
    .string()
    .trim()
    .min(1, 'La nota no puede estar vacía')
    .max(10000, 'La nota es demasiado larga'),
});

export const esquemaAnular = z.object({
  motivo,
});

export const esquemaListadoVisitas = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  pacienteId: z.coerce.number().int().positive().optional(),
  ingresoId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['borrador', 'cerrada', 'corregida']).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export const esquemaCrearMedicacion = z.object({
  medicamento: z
    .string()
    .trim()
    .min(1, 'El medicamento no puede estar vacío')
    .max(200, 'El medicamento es demasiado largo'),
  dosis: textoOpcional(200, 'La dosis es demasiado larga'),
  via: textoOpcional(100, 'La vía es demasiado larga'),
  frecuencia: textoOpcional(200, 'La frecuencia es demasiado larga'),
  duracionDias: enteroOpcional(0, 3650, 'La duración no puede ser negativa ni superar 3650 días'),
  indicaciones: textoOpcional(5000, 'Las indicaciones son demasiado largas'),
  pesoReferenciaKg: numeroOpcional(0.01, 9999.99, 'El peso de referencia debe ser mayor que cero'),
  motivoCambio: z
    .string()
    .trim()
    .min(3, 'El motivo del cambio debe tener al menos 3 caracteres')
    .max(2000, 'El motivo del cambio es demasiado largo')
    .optional(),
});

export const esquemaActualizarMedicacion = z
  .object({
    medicamento: z
      .string()
      .trim()
      .min(1, 'El medicamento no puede estar vacío')
      .max(200, 'El medicamento es demasiado largo')
      .optional(),
    dosis: textoOpcional(200, 'La dosis es demasiado larga'),
    via: textoOpcional(100, 'La vía es demasiado larga'),
    frecuencia: textoOpcional(200, 'La frecuencia es demasiado larga'),
    duracionDias: enteroOpcional(0, 3650, 'La duración no puede ser negativa ni superar 3650 días'),
    indicaciones: textoOpcional(5000, 'Las indicaciones son demasiado largas'),
    pesoReferenciaKg: numeroOpcional(
      0.01,
      9999.99,
      'El peso de referencia debe ser mayor que cero',
    ),
    motivoCambio: z
      .string()
      .trim()
      .min(3, 'El motivo del cambio debe tener al menos 3 caracteres')
      .max(2000, 'El motivo del cambio es demasiado largo')
      .optional(),
  })
  .refine((datos) => Object.keys(datos).some((campo) => campo !== 'motivoCambio'), {
    message: 'No hay cambios para guardar',
  });
