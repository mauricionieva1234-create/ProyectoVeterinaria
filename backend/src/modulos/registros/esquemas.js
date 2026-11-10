import { z } from 'zod';

const textoOpcional = (max, mensaje) => z.string().trim().max(max, mensaje).nullable().optional();

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato aaaa-mm-dd');

const idOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined) return undefined;
  if (valor === null) return null;
  return Number(valor);
}, z.number().int().positive().nullable().optional());

export const TIPOS_REGISTRO = ['vacuna', 'antiparasitario', 'estudio', 'cirugia'];

export const esquemaTipoRegistro = z.enum(TIPOS_REGISTRO, {
  message: 'El tipo de registro no es válido',
});

export const esquemaListadoRegistros = z.object({
  tipo: esquemaTipoRegistro.optional(),
});

export const esquemaAnular = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo debe tener al menos 3 caracteres')
    .max(2000, 'El motivo es demasiado largo'),
});

const camposVacuna = {
  vacuna: z
    .string()
    .trim()
    .min(1, 'La vacuna no puede estar vacía')
    .max(200, 'El nombre de la vacuna es demasiado largo'),
  lote: textoOpcional(100, 'El lote es demasiado largo'),
  fechaAplicacion: fecha,
  fechaProximaDosis: fecha.nullable().optional(),
  aplicadaPor: idOpcional,
};

export const esquemaCrearVacuna = z.object({
  pacienteId: z.coerce.number().int().positive(),
  visitaId: idOpcional,
  ...camposVacuna,
});

export const esquemaActualizarVacuna = z.object({
  vacuna: camposVacuna.vacuna.optional(),
  lote: camposVacuna.lote,
  fechaAplicacion: camposVacuna.fechaAplicacion.optional(),
  fechaProximaDosis: camposVacuna.fechaProximaDosis,
  aplicadaPor: camposVacuna.aplicadaPor,
});

const camposAntiparasitario = {
  producto: z
    .string()
    .trim()
    .min(1, 'El producto no puede estar vacío')
    .max(200, 'El nombre del producto es demasiado largo'),
  tipo: z.enum(['interno', 'externo'], { message: 'El tipo no es válido' }),
  dosis: textoOpcional(200, 'La dosis es demasiado larga'),
  fechaAplicacion: fecha,
  fechaProxima: fecha.nullable().optional(),
  aplicadoPor: idOpcional,
};

export const esquemaCrearAntiparasitario = z.object({
  pacienteId: z.coerce.number().int().positive(),
  visitaId: idOpcional,
  ...camposAntiparasitario,
});

export const esquemaActualizarAntiparasitario = z.object({
  producto: camposAntiparasitario.producto.optional(),
  tipo: camposAntiparasitario.tipo.optional(),
  dosis: camposAntiparasitario.dosis,
  fechaAplicacion: camposAntiparasitario.fechaAplicacion.optional(),
  fechaProxima: camposAntiparasitario.fechaProxima,
  aplicadoPor: camposAntiparasitario.aplicadoPor,
});

const camposEstudio = {
  tipoEstudio: z
    .string()
    .trim()
    .min(1, 'El tipo de estudio no puede estar vacío')
    .max(200, 'El tipo de estudio es demasiado largo'),
  fechaPedido: fecha,
  estado: z.enum(['pedido', 'realizado', 'resultado_cargado']).default('pedido'),
  fechaResultado: fecha.nullable().optional(),
  resultadoResumen: textoOpcional(10000, 'El resumen del resultado es demasiado largo'),
};

export const esquemaCrearEstudio = z.object({
  pacienteId: z.coerce.number().int().positive(),
  visitaId: idOpcional,
  ...camposEstudio,
});

export const esquemaActualizarEstudio = z.object({
  tipoEstudio: camposEstudio.tipoEstudio.optional(),
  fechaPedido: camposEstudio.fechaPedido.optional(),
  estado: z.enum(['pedido', 'realizado', 'resultado_cargado']).optional(),
  fechaResultado: camposEstudio.fechaResultado,
  resultadoResumen: camposEstudio.resultadoResumen,
});

const camposCirugia = {
  tipoCirugia: z
    .string()
    .trim()
    .min(1, 'El tipo de cirugía no puede estar vacío')
    .max(200, 'El tipo de cirugía es demasiado largo'),
  fechaProgramada: fecha.nullable().optional(),
  estado: z.enum(['programada', 'realizada', 'suspendida', 'cancelada']).default('programada'),
  indicacionesPrevias: textoOpcional(5000, 'Las indicaciones previas son demasiado largas'),
  notasPostoperatorio: textoOpcional(10000, 'Las notas postoperatorias son demasiado largas'),
  cirujanoId: idOpcional,
};

export const esquemaCrearCirugia = z.object({
  pacienteId: z.coerce.number().int().positive(),
  visitaId: idOpcional,
  ...camposCirugia,
});

export const esquemaActualizarCirugia = z.object({
  tipoCirugia: camposCirugia.tipoCirugia.optional(),
  fechaProgramada: camposCirugia.fechaProgramada,
  estado: z.enum(['programada', 'realizada', 'suspendida', 'cancelada']).optional(),
  indicacionesPrevias: camposCirugia.indicacionesPrevias,
  notasPostoperatorio: camposCirugia.notasPostoperatorio,
  cirujanoId: camposCirugia.cirujanoId,
});

export const ESQUEMAS_CREAR = {
  vacuna: esquemaCrearVacuna,
  antiparasitario: esquemaCrearAntiparasitario,
  estudio: esquemaCrearEstudio,
  cirugia: esquemaCrearCirugia,
};

export const ESQUEMAS_ACTUALIZAR = {
  vacuna: esquemaActualizarVacuna,
  antiparasitario: esquemaActualizarAntiparasitario,
  estudio: esquemaActualizarEstudio,
  cirugia: esquemaActualizarCirugia,
};
