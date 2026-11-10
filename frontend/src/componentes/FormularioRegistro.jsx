import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { actualizarRegistro, crearRegistro } from '../api/registros.js';
import { ETIQUETAS_TIPO_REGISTRO, etiqueta } from '../utils/etiquetasClinicas.js';
import { armarCuerpoRegistro } from '../utils/registros.js';

const TIPOS = ['vacuna', 'antiparasitario', 'estudio', 'cirugia'];

const fecha = z
  .string()
  .min(1, 'Elegí una fecha')
  .refine((valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Usá el formato aaaa-mm-dd');

const fechaOpcional = z
  .string()
  .optional()
  .refine((valor) => !valor || /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Usá el formato aaaa-mm-dd');

const textoOpcional = (max, mensaje) => z.string().trim().max(max, mensaje).optional();

const esquemaVacuna = z.object({
  vacuna: z
    .string()
    .trim()
    .min(1, 'La vacuna es obligatoria')
    .max(200, 'El nombre de la vacuna es demasiado largo'),
  lote: textoOpcional(100, 'El lote es demasiado largo'),
  fechaAplicacion: fecha,
  fechaProximaDosis: fechaOpcional,
});

const esquemaAntiparasitario = z.object({
  producto: z
    .string()
    .trim()
    .min(1, 'El producto es obligatorio')
    .max(200, 'El nombre del producto es demasiado largo'),
  tipo: z.enum(['interno', 'externo']),
  dosis: textoOpcional(200, 'La dosis es demasiado larga'),
  fechaAplicacion: fecha,
  fechaProxima: fechaOpcional,
});

const esquemaEstudio = z
  .object({
    tipoEstudio: z
      .string()
      .trim()
      .min(1, 'El tipo de estudio es obligatorio')
      .max(200, 'El tipo de estudio es demasiado largo'),
    fechaPedido: fecha,
    estado: z.enum(['pedido', 'realizado', 'resultado_cargado']),
    fechaResultado: fechaOpcional,
    resultadoResumen: textoOpcional(10000, 'El resumen es demasiado largo'),
  })
  .superRefine((datos, contexto) => {
    if (datos.estado === 'resultado_cargado' && !datos.fechaResultado) {
      contexto.addIssue({
        code: 'custom',
        path: ['fechaResultado'],
        message: 'Indicá la fecha del resultado',
      });
    }
  });

const esquemaCirugia = z
  .object({
    tipoCirugia: z
      .string()
      .trim()
      .min(1, 'El tipo de cirugía es obligatorio')
      .max(200, 'El tipo de cirugía es demasiado largo'),
    fechaProgramada: fechaOpcional,
    estado: z.enum(['programada', 'realizada', 'suspendida', 'cancelada']),
    indicacionesPrevias: textoOpcional(5000, 'Las indicaciones son demasiado largas'),
    notasPostoperatorio: textoOpcional(10000, 'Las notas son demasiado largas'),
  })
  .superRefine((datos, contexto) => {
    if (datos.estado === 'programada' && !datos.fechaProgramada) {
      contexto.addIssue({
        code: 'custom',
        path: ['fechaProgramada'],
        message: 'Una cirugía programada necesita fecha',
      });
    }
  });

const ESQUEMAS = {
  vacuna: esquemaVacuna,
  antiparasitario: esquemaAntiparasitario,
  estudio: esquemaEstudio,
  cirugia: esquemaCirugia,
};

function valoresIniciales(tipo, registro) {
  if (!registro) {
    return {
      vacuna: '',
      lote: '',
      fechaAplicacion: '',
      fechaProximaDosis: '',
      producto: '',
      tipoAntiparasitario: 'interno',
      dosis: '',
      fechaProxima: '',
      tipoEstudio: '',
      fechaPedido: '',
      estado: tipo === 'cirugia' ? 'programada' : 'pedido',
      fechaResultado: '',
      resultadoResumen: '',
      tipoCirugia: '',
      fechaProgramada: '',
      indicacionesPrevias: '',
      notasPostoperatorio: '',
    };
  }

  return {
    vacuna: registro.vacuna ?? '',
    lote: registro.lote ?? '',
    fechaAplicacion: registro.fechaAplicacion ?? '',
    fechaProximaDosis: registro.fechaProximaDosis ?? '',
    producto: registro.producto ?? '',
    // El backend devuelve el tipo de antiparasitario como `tipoProducto`.
    tipoAntiparasitario: registro.tipoProducto ?? registro.tipo ?? 'interno',
    dosis: registro.dosis ?? '',
    fechaProxima: registro.fechaProxima ?? '',
    tipoEstudio: registro.tipoEstudio ?? '',
    fechaPedido: registro.fechaPedido ?? '',
    estado: registro.estado ?? 'pedido',
    fechaResultado: registro.fechaResultado ?? '',
    resultadoResumen: registro.resultadoResumen ?? '',
    tipoCirugia: registro.tipoCirugia ?? '',
    fechaProgramada: registro.fechaProgramada ?? '',
    indicacionesPrevias: registro.indicacionesPrevias ?? '',
    notasPostoperatorio: registro.notasPostoperatorio ?? '',
  };
}

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

function Campo({ etiqueta: nombre, htmlFor, error, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {nombre}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

function CamposRegistro({ tipo, registro, pacienteId, visitaId, onGuardado, onCancelar }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(ESQUEMAS[tipo]),
    defaultValues: valoresIniciales(tipo, registro),
  });

  const guardar = useMutation({
    mutationFn: (datos) =>
      registro ? actualizarRegistro(tipo, registro.id, datos) : crearRegistro(tipo, datos),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['registros', pacienteId] });
      queryClient.invalidateQueries({ queryKey: ['visita', visitaId] });
      onGuardado(datos.registro);
    },
  });

  function alEnviar(datos) {
    guardar.mutate(armarCuerpoRegistro(tipo, datos, { pacienteId, visitaId }));
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      {tipo === 'vacuna' && (
        <>
          <Campo etiqueta="Vacuna" htmlFor="registro-vacuna" error={errors.vacuna}>
            <input
              id="registro-vacuna"
              className={claseControl}
              aria-invalid={errors.vacuna ? 'true' : 'false'}
              {...register('vacuna')}
            />
          </Campo>
          <Campo etiqueta="Lote" htmlFor="registro-lote" error={errors.lote}>
            <input id="registro-lote" className={claseControl} {...register('lote')} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Fecha de aplicación"
              htmlFor="registro-fecha-aplicacion"
              error={errors.fechaAplicacion}
            >
              <input
                id="registro-fecha-aplicacion"
                type="date"
                className={claseControl}
                {...register('fechaAplicacion')}
              />
            </Campo>
            <Campo
              etiqueta="Próxima dosis"
              htmlFor="registro-proxima-dosis"
              error={errors.fechaProximaDosis}
            >
              <input
                id="registro-proxima-dosis"
                type="date"
                className={claseControl}
                {...register('fechaProximaDosis')}
              />
            </Campo>
          </div>
        </>
      )}

      {tipo === 'antiparasitario' && (
        <>
          <Campo etiqueta="Producto" htmlFor="registro-producto" error={errors.producto}>
            <input
              id="registro-producto"
              className={claseControl}
              aria-invalid={errors.producto ? 'true' : 'false'}
              {...register('producto')}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Tipo" htmlFor="registro-tipo-antiparasitario" error={errors.tipo}>
              <select
                id="registro-tipo-antiparasitario"
                className={claseControl}
                {...register('tipoAntiparasitario')}
              >
                <option value="interno">Interno</option>
                <option value="externo">Externo</option>
              </select>
            </Campo>
            <Campo etiqueta="Dosis" htmlFor="registro-dosis" error={errors.dosis}>
              <input id="registro-dosis" className={claseControl} {...register('dosis')} />
            </Campo>
            <Campo
              etiqueta="Fecha de aplicación"
              htmlFor="registro-fecha-aplicacion-antiparasitario"
              error={errors.fechaAplicacion}
            >
              <input
                id="registro-fecha-aplicacion-antiparasitario"
                type="date"
                className={claseControl}
                {...register('fechaAplicacion')}
              />
            </Campo>
            <Campo
              etiqueta="Próxima aplicación"
              htmlFor="registro-proxima"
              error={errors.fechaProxima}
            >
              <input
                id="registro-proxima"
                type="date"
                className={claseControl}
                {...register('fechaProxima')}
              />
            </Campo>
          </div>
        </>
      )}

      {tipo === 'estudio' && (
        <>
          <Campo
            etiqueta="Tipo de estudio"
            htmlFor="registro-tipo-estudio"
            error={errors.tipoEstudio}
          >
            <input
              id="registro-tipo-estudio"
              className={claseControl}
              aria-invalid={errors.tipoEstudio ? 'true' : 'false'}
              {...register('tipoEstudio')}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Fecha del pedido"
              htmlFor="registro-fecha-pedido"
              error={errors.fechaPedido}
            >
              <input
                id="registro-fecha-pedido"
                type="date"
                className={claseControl}
                {...register('fechaPedido')}
              />
            </Campo>
            <Campo etiqueta="Estado" htmlFor="registro-estado-estudio" error={errors.estado}>
              <select id="registro-estado-estudio" className={claseControl} {...register('estado')}>
                <option value="pedido">Pedido</option>
                <option value="realizado">Realizado</option>
                <option value="resultado_cargado">Resultado cargado</option>
              </select>
            </Campo>
          </div>
          <Campo
            etiqueta="Fecha del resultado"
            htmlFor="registro-fecha-resultado"
            error={errors.fechaResultado}
          >
            <input
              id="registro-fecha-resultado"
              type="date"
              className={claseControl}
              {...register('fechaResultado')}
            />
          </Campo>
          <Campo
            etiqueta="Resumen del resultado"
            htmlFor="registro-resumen"
            error={errors.resultadoResumen}
          >
            <textarea
              id="registro-resumen"
              rows={3}
              className={claseControl}
              {...register('resultadoResumen')}
            />
          </Campo>
        </>
      )}

      {tipo === 'cirugia' && (
        <>
          <Campo
            etiqueta="Tipo de cirugía"
            htmlFor="registro-tipo-cirugia"
            error={errors.tipoCirugia}
          >
            <input
              id="registro-tipo-cirugia"
              className={claseControl}
              aria-invalid={errors.tipoCirugia ? 'true' : 'false'}
              {...register('tipoCirugia')}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Fecha programada"
              htmlFor="registro-fecha-programada"
              error={errors.fechaProgramada}
            >
              <input
                id="registro-fecha-programada"
                type="date"
                className={claseControl}
                {...register('fechaProgramada')}
              />
            </Campo>
            <Campo etiqueta="Estado" htmlFor="registro-estado-cirugia" error={errors.estado}>
              <select id="registro-estado-cirugia" className={claseControl} {...register('estado')}>
                <option value="programada">Programada</option>
                <option value="realizada">Realizada</option>
                <option value="suspendida">Suspendida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </Campo>
          </div>
          <Campo
            etiqueta="Indicaciones previas"
            htmlFor="registro-indicaciones"
            error={errors.indicacionesPrevias}
          >
            <textarea
              id="registro-indicaciones"
              rows={3}
              className={claseControl}
              {...register('indicacionesPrevias')}
            />
          </Campo>
          <Campo
            etiqueta="Notas postoperatorias"
            htmlFor="registro-notas"
            error={errors.notasPostoperatorio}
          >
            <textarea
              id="registro-notas"
              rows={3}
              className={claseControl}
              {...register('notasPostoperatorio')}
            />
          </Campo>
        </>
      )}

      {guardar.isError && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {guardar.error.message}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={guardar.isPending}
        >
          {guardar.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

export function FormularioRegistro({
  tipo: tipoInicial = 'vacuna',
  registro,
  pacienteId,
  visitaId,
  onGuardado,
  onCancelar,
}) {
  const [tipo, setTipo] = useState(registro ? tipoInicial : tipoInicial);

  return (
    <div className="space-y-4">
      {!registro && (
        <div>
          <label htmlFor="tipo-registro" className="block text-sm font-medium text-slate-700">
            Tipo de registro
          </label>
          <select
            id="tipo-registro"
            className={claseControl}
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value)}
          >
            {TIPOS.map((valor) => (
              <option key={valor} value={valor}>
                {etiqueta(ETIQUETAS_TIPO_REGISTRO, valor)}
              </option>
            ))}
          </select>
        </div>
      )}

      <CamposRegistro
        key={tipo}
        tipo={tipo}
        registro={registro}
        pacienteId={pacienteId}
        visitaId={visitaId}
        onGuardado={onGuardado}
        onCancelar={onCancelar}
      />
    </div>
  );
}
