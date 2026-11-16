import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { exportarHistoriaClinica, obtenerHistoriaClinica } from '../api/historia.js';
import { Modal } from '../componentes/Modal.jsx';
import {
  ETIQUETAS_CANAL_AVISO,
  ETIQUETAS_ESTADO_CONTROL,
  ETIQUETAS_ESTADO_REGISTRO,
  ETIQUETAS_ESTADO_VISITA,
  ETIQUETAS_FRANJA,
  ETIQUETAS_RESULTADO_AVISO,
  ETIQUETAS_TIPO_ANTIPARASITARIO,
  etiqueta,
} from '../utils/etiquetasClinicas.js';
import { calcularEdad, formatearFecha, formatearHora } from '../utils/formato.js';

const claseBoton =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50';

const claseBotonPrincipal =
  'rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60';

function Dato({ etiqueta: nombre, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{nombre}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children || '—'}</dd>
    </div>
  );
}

function Vacio({ children }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

function Seccion({ titulo, children }) {
  return (
    <section className="space-y-3 break-inside-avoid">
      <h2 className="border-b border-slate-300 pb-1 text-lg font-semibold text-slate-900">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function BloqueTexto({ titulo, children }) {
  if (!children) return null;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm text-slate-800">{children}</p>
    </div>
  );
}

function Badge({ children, tono = 'slate' }) {
  const clases = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-50 text-amber-800',
    sky: 'bg-sky-50 text-sky-800',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <span className={['rounded-full px-2 py-0.5 text-xs font-medium', clases[tono]].join(' ')}>
      {children}
    </span>
  );
}

function EstadoVisita({ estado }) {
  const tono = estado === 'borrador' ? 'amber' : estado === 'corregida' ? 'sky' : 'emerald';
  return <Badge tono={tono}>{etiqueta(ETIQUETAS_ESTADO_VISITA, estado)}</Badge>;
}

function ListaVisitas({ visitas }) {
  if (visitas.length === 0) return <Vacio>Todavía no hay visitas registradas.</Vacio>;

  return (
    <div className="space-y-5">
      {visitas.map((visita) => (
        <article
          key={visita.id}
          className="space-y-3 break-inside-avoid rounded-xl border border-slate-200 p-4"
        >
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">
                {formatearFecha(visita.inicioEn)} · {formatearHora(visita.inicioEn)}
              </p>
              <p className="text-xs text-slate-500">
                Veterinario: {visita.veterinarioNombre ?? '—'}
                {visita.cierreEn ? ` · Cerrada el ${formatearFecha(visita.cierreEn)}` : ''}
              </p>
            </div>
            <EstadoVisita estado={visita.estado} />
          </header>

          <dl className="grid gap-3 sm:grid-cols-3">
            <Dato etiqueta="Temperatura">
              {visita.temperaturaC !== null && visita.temperaturaC !== undefined
                ? `${visita.temperaturaC} °C`
                : '—'}
            </Dato>
            <Dato etiqueta="Peso">
              {visita.pesoKg !== null && visita.pesoKg !== undefined ? `${visita.pesoKg} kg` : '—'}
            </Dato>
            <Dato etiqueta="Motivo de consulta">{visita.motivoConsulta}</Dato>
          </dl>

          <BloqueTexto titulo="Anamnesis">{visita.anamnesis}</BloqueTexto>
          <BloqueTexto titulo="Diagnóstico">{visita.diagnostico}</BloqueTexto>
          <BloqueTexto titulo="Observaciones">{visita.observaciones}</BloqueTexto>

          {visita.medicacion.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Medicación
              </p>
              <table className="mt-1 min-w-full divide-y divide-slate-200 text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">Medicamento</th>
                    <th className="py-1 pr-3">Dosis</th>
                    <th className="py-1 pr-3">Vía</th>
                    <th className="py-1 pr-3">Frecuencia</th>
                    <th className="py-1">Duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visita.medicacion.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 pr-3 font-medium text-slate-800">{item.medicamento}</td>
                      <td className="py-1 pr-3">{item.dosis ?? '—'}</td>
                      <td className="py-1 pr-3">{item.via ?? '—'}</td>
                      <td className="py-1 pr-3">{item.frecuencia ?? '—'}</td>
                      <td className="py-1">
                        {item.duracionDias ? `${item.duracionDias} días` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {visita.notas.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notas</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-800">
                {visita.notas.map((nota) => (
                  <li key={nota.id}>
                    <span className="text-xs text-slate-500">
                      {formatearFecha(nota.creadoEn)} · {nota.autorNombre}:
                    </span>{' '}
                    {nota.texto}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function TablaRegistros({ titulo, registros, columnas }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
      {registros.length === 0 ? (
        <Vacio>Sin registros.</Vacio>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columnas.map((columna) => (
                  <th key={columna.titulo} className="py-1 pr-3">
                    {columna.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((registro) => (
                <tr key={registro.id}>
                  {columnas.map((columna) => (
                    <td key={columna.titulo} className="py-1 pr-3 align-top text-slate-800">
                      {columna.valor(registro) || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListaControles({ controles }) {
  if (controles.length === 0) return <Vacio>Todavía no hay controles registrados.</Vacio>;

  return (
    <div className="space-y-3">
      {controles.map((control) => (
        <article
          key={control.id}
          className="space-y-2 break-inside-avoid rounded-xl border border-slate-200 p-4"
        >
          <header className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-900">
              {formatearFecha(control.fechaControl)} · {etiqueta(ETIQUETAS_FRANJA, control.franja)}
            </p>
            <Badge
              tono={
                control.estado === 'pendiente'
                  ? 'amber'
                  : control.estado === 'ausente'
                    ? 'red'
                    : 'emerald'
              }
            >
              {etiqueta(ETIQUETAS_ESTADO_CONTROL, control.estado)}
            </Badge>
          </header>
          {control.motivo && <p className="text-sm text-slate-800">{control.motivo}</p>}
          {control.avisos.length > 0 && (
            <ul className="space-y-1 text-sm text-slate-700">
              {control.avisos.map((aviso) => (
                <li key={aviso.id}>
                  <span className="text-xs text-slate-500">
                    {formatearFecha(aviso.realizadoEn)} ·{' '}
                    {etiqueta(ETIQUETAS_CANAL_AVISO, aviso.canal)} ·{' '}
                    {etiqueta(ETIQUETAS_RESULTADO_AVISO, aviso.resultado)} ·{' '}
                    {aviso.realizadoPorNombre}:
                  </span>{' '}
                  {aviso.nota ?? 'Sin nota'}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

function formatearTamano(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HistoriaClinica() {
  const { id } = useParams();
  const [modalExportar, setModalExportar] = useState(false);
  const [entregadoA, setEntregadoA] = useState('');
  const [documentoVerificado, setDocumentoVerificado] = useState(false);
  const [entrega, setEntrega] = useState(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['historia-clinica', id],
    queryFn: () => obtenerHistoriaClinica(id),
  });

  const exportar = useMutation({
    mutationFn: (datos) => exportarHistoriaClinica(id, datos),
    onSuccess: (datos) => {
      const historia = datos.historia;
      setModalExportar(false);
      setDocumentoVerificado(false);
      setEntrega({ entregadoA, generadoEn: historia.generadoEn });

      // Se deja que React pinte el pie de entrega antes de abrir el diálogo
      // de impresión. Guardar como PDF es la forma de exportar el documento.
      setTimeout(() => window.print(), 150);
    },
  });

  if (isPending) {
    return (
      <p className="text-slate-600" role="status">
        Cargando historia clínica...
      </p>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 print:hidden">
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" role="alert">
          No se pudo cargar la historia clínica: {error.message}
        </p>
        <Link to={`/pacientes/${id}`} className="text-sm text-teal-800 hover:underline">
          Volver a la ficha del paciente
        </Link>
      </div>
    );
  }

  const historia = data.historia;
  const paciente = historia.paciente;
  const cliente = paciente.cliente;
  const registros = historia.registros;

  function abrirExportacion() {
    setEntregadoA(cliente?.nombreCompleto ?? '');
    setDocumentoVerificado(false);
    exportar.reset();
    setModalExportar(true);
  }

  function confirmarExportacion(evento) {
    evento.preventDefault();
    exportar.mutate({ entregadoA: entregadoA.trim(), documentoVerificado });
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to={`/pacientes/${id}`}
          className="text-sm font-medium text-violet-800 hover:underline"
        >
          ← Volver a la ficha del paciente
        </Link>

        <button type="button" className={claseBotonPrincipal} onClick={abrirExportacion}>
          Imprimir / exportar
        </button>
      </div>

      {entrega && (
        <p
          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 print:hidden"
          role="status"
        >
          Historia entregada a {entrega.entregadoA}. La exportación quedó registrada en la
          auditoría.
        </p>
      )}

      <article className="mx-auto max-w-4xl space-y-8 rounded-2xl bg-white p-6 text-slate-900 shadow-lg shadow-slate-900/10 sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="space-y-4 border-b-2 border-teal-700 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                Veterinaria
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Historia clínica</h1>
              <p className="text-sm text-slate-600">{paciente.nombre}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-mono">{paciente.codigoInterno}</p>
              <p>Generada el {formatearFecha(historia.generadoEn)}</p>
              <p>{formatearHora(historia.generadoEn)} hs</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <Dato etiqueta="Especie">
              {paciente.especieNombre}
              {paciente.razaNombre ? ` · ${paciente.razaNombre}` : ''}
            </Dato>
            <Dato etiqueta="Sexo">
              {paciente.sexo === 'macho'
                ? 'Macho'
                : paciente.sexo === 'hembra'
                  ? 'Hembra'
                  : 'Desconocido'}
            </Dato>
            <Dato etiqueta="Edad">
              {paciente.fechaNacimiento ? calcularEdad(paciente.fechaNacimiento) || '—' : '—'}
            </Dato>
            <Dato etiqueta="Titular">{cliente?.nombreCompleto ?? '—'}</Dato>
            <Dato etiqueta="Teléfono">{cliente?.telefonoPrincipal ?? '—'}</Dato>
            <Dato etiqueta="Estado">
              {paciente.fechaDeceso
                ? `Fallecido el ${formatearFecha(paciente.fechaDeceso)}`
                : 'Activo'}
            </Dato>
          </dl>
        </header>

        <Seccion titulo="Visitas clínicas">
          <ListaVisitas visitas={historia.visitas} />
        </Seccion>

        <Seccion titulo="Registros clínicos">
          <div className="space-y-4">
            <TablaRegistros
              titulo="Vacunas"
              registros={registros.vacunas}
              columnas={[
                { titulo: 'Vacuna', valor: (fila) => fila.vacuna },
                { titulo: 'Lote', valor: (fila) => fila.lote },
                { titulo: 'Aplicación', valor: (fila) => formatearFecha(fila.fechaAplicacion) },
                {
                  titulo: 'Próxima dosis',
                  valor: (fila) => formatearFecha(fila.fechaProximaDosis),
                },
                { titulo: 'Aplicada por', valor: (fila) => fila.aplicadaPorNombre },
              ]}
            />

            <TablaRegistros
              titulo="Antiparasitarios"
              registros={registros.antiparasitarios}
              columnas={[
                { titulo: 'Producto', valor: (fila) => fila.producto },
                {
                  titulo: 'Tipo',
                  valor: (fila) => etiqueta(ETIQUETAS_TIPO_ANTIPARASITARIO, fila.tipoProducto),
                },
                { titulo: 'Dosis', valor: (fila) => fila.dosis },
                { titulo: 'Aplicación', valor: (fila) => formatearFecha(fila.fechaAplicacion) },
                { titulo: 'Próxima', valor: (fila) => formatearFecha(fila.fechaProxima) },
              ]}
            />

            <TablaRegistros
              titulo="Estudios"
              registros={registros.estudios}
              columnas={[
                { titulo: 'Estudio', valor: (fila) => fila.tipoEstudio },
                { titulo: 'Pedido', valor: (fila) => formatearFecha(fila.fechaPedido) },
                {
                  titulo: 'Estado',
                  valor: (fila) => etiqueta(ETIQUETAS_ESTADO_REGISTRO, fila.estado),
                },
                { titulo: 'Resultado', valor: (fila) => fila.resultadoResumen },
              ]}
            />

            <TablaRegistros
              titulo="Cirugías"
              registros={registros.cirugias}
              columnas={[
                { titulo: 'Cirugía', valor: (fila) => fila.tipoCirugia },
                { titulo: 'Programada', valor: (fila) => formatearFecha(fila.fechaProgramada) },
                {
                  titulo: 'Estado',
                  valor: (fila) => etiqueta(ETIQUETAS_ESTADO_REGISTRO, fila.estado),
                },
                { titulo: 'Cirujano', valor: (fila) => fila.cirujanoNombre },
              ]}
            />
          </div>
        </Seccion>

        <Seccion titulo="Controles y avisos">
          <ListaControles controles={historia.controles} />
        </Seccion>

        <Seccion titulo="Adjuntos">
          {historia.adjuntos.length === 0 ? (
            <Vacio>Sin adjuntos.</Vacio>
          ) : (
            <ul className="space-y-1 text-sm text-slate-800">
              {historia.adjuntos.map((adjunto) => (
                <li key={adjunto.id}>
                  {adjunto.nombreOriginal}{' '}
                  <span className="text-xs text-slate-500">
                    ({formatearTamano(adjunto.tamanoBytes)} ·{' '}
                    {adjunto.subidoPorNombre ?? 'Sin autor'} · {formatearFecha(adjunto.creadoEn)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <footer className="space-y-1 border-t border-slate-300 pt-3 text-xs text-slate-500">
          <p>
            Documento de solo lectura generado por el sistema de gestión veterinaria. Los datos
            clínicos anulados no se imprimen.
          </p>
          {entrega && (
            <p>
              Entregado a {entrega.entregadoA} el {formatearFecha(entrega.generadoEn)} a las{' '}
              {formatearHora(entrega.generadoEn)} hs. Verificación del documento del titular
              registrada en la auditoría.
            </p>
          )}
        </footer>
      </article>

      <Modal
        abierto={modalExportar}
        titulo="Entregar historia clínica"
        onCerrar={() => setModalExportar(false)}
      >
        <form className="space-y-4" onSubmit={confirmarExportacion}>
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            La historia clínica solo se entrega al titular. Verificá su documento antes de
            continuar.
          </p>

          <div>
            <label htmlFor="entregado-a" className="block text-sm font-medium text-slate-700">
              Se entrega a
            </label>
            <input
              id="entregado-a"
              type="text"
              value={entregadoA}
              onChange={(evento) => setEntregadoA(evento.target.value)}
              maxLength={160}
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre y documento del titular"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={documentoVerificado}
              onChange={(evento) => setDocumentoVerificado(evento.target.checked)}
              className="mt-0.5"
            />
            <span>Verifiqué el documento del titular antes de entregar la historia.</span>
          </label>

          {exportar.isError && (
            <p
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {exportar.error.message}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={claseBoton} onClick={() => setModalExportar(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              className={claseBotonPrincipal}
              disabled={exportar.isPending || !documentoVerificado || entregadoA.trim().length < 3}
            >
              {exportar.isPending ? 'Registrando...' : 'Imprimir / exportar'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
