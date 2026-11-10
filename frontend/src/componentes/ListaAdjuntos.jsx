import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { anularAdjunto, listarAdjuntos, urlDescargaAdjunto } from '../api/adjuntos.js';
import { useSesion } from '../hooks/useSesion.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';
import { FormularioAnular } from './FormularioAnular.jsx';
import { Modal } from './Modal.jsx';

function formatearTamano(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ListaAdjuntos({ pacienteId, visitaId, estudioId }) {
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const puedeAnular = (sesion?.permisos ?? []).includes('adjuntos.anular');
  const [paraAnular, setParaAnular] = useState(null);

  const filtros = { pacienteId, visitaId, estudioId };
  const consulta = useQuery({
    queryKey: ['adjuntos', filtros],
    queryFn: () => listarAdjuntos(filtros),
  });

  const anular = useMutation({
    mutationFn: ({ id, motivo }) => anularAdjunto(id, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjuntos'] });
      queryClient.invalidateQueries({ queryKey: ['paciente', pacienteId] });
      setParaAnular(null);
    },
  });

  if (consulta.isPending) {
    return <p className="text-sm text-slate-600">Cargando adjuntos...</p>;
  }

  if (consulta.isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        No se pudieron cargar los adjuntos: {consulta.error.message}
      </p>
    );
  }

  const adjuntos = consulta.data?.adjuntos ?? [];

  if (adjuntos.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay archivos adjuntos.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Archivo</th>
              <th className="px-3 py-2">Tamaño</th>
              <th className="px-3 py-2">Subido por</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {adjuntos.map((adjunto) => (
              <tr key={adjunto.id}>
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-800">{adjunto.nombreOriginal}</span>
                  <p className="text-xs text-slate-500">{adjunto.tipoMime}</p>
                </td>
                <td className="px-3 py-2 text-slate-600">{formatearTamano(adjunto.tamanoBytes)}</td>
                <td className="px-3 py-2 text-slate-600">{adjunto.subidoPorNombre ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600">
                  {formatearFecha(adjunto.creadoEn)} {formatearHora(adjunto.creadoEn)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <a
                      href={urlDescargaAdjunto(adjunto.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Abrir
                    </a>
                    {puedeAnular && (
                      <button
                        type="button"
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => setParaAnular(adjunto)}
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={Boolean(paraAnular)}
        titulo="Anular adjunto"
        onCerrar={() => setParaAnular(null)}
      >
        <FormularioAnular
          entidad="adjunto"
          onAnular={(motivo) => anular.mutate({ id: paraAnular.id, motivo })}
          onCancelar={() => setParaAnular(null)}
          pendiente={anular.isPending}
          error={anular.error}
        />
      </Modal>
    </>
  );
}
