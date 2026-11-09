import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { obtenerCliente, unirClientes } from '../api/clientes.js';
import { FormularioCliente } from '../componentes/FormularioCliente.jsx';
import { FormularioPaciente } from '../componentes/FormularioPaciente.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { SelectorCliente } from '../componentes/SelectorCliente.jsx';
import { useSesion } from '../hooks/useSesion.js';
import { calcularEdad, formatearFecha } from '../utils/formato.js';

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function UnirCliente({ cliente, onUnido, onCancelar }) {
  const [conservado, setConservado] = useState(null);
  const queryClient = useQueryClient();

  const unir = useMutation({
    mutationFn: () => unirClientes(cliente.id, conservado.id),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', cliente.id] });
      queryClient.invalidateQueries({ queryKey: ['cliente', datos.clienteConservado.id] });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      onUnido(datos.clienteConservado.id);
    },
  });

  return (
    <div className="space-y-4">
      <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Este cliente se va a fusionar en el cliente que elijas. Sus pacientes y el historial de
        dueños pasan al cliente conservado, y este queda marcado como fusionado.
      </p>

      <SelectorCliente cliente={conservado} onSeleccionar={setConservado} excluirId={cliente.id} />

      {unir.isError && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {unir.error.message}
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
          type="button"
          className="rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
          onClick={() => unir.mutate()}
          disabled={!conservado || unir.isPending}
        >
          {unir.isPending ? 'Uniendo...' : 'Unir clientes'}
        </button>
      </div>
    </div>
  );
}

export function FichaCliente() {
  const { id } = useParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const esAdmin = sesion?.usuario?.rol === 'admin';

  const [modalEditar, setModalEditar] = useState(false);
  const [modalPaciente, setModalPaciente] = useState(false);
  const [modalUnir, setModalUnir] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => obtenerCliente(id),
  });

  if (isPending) {
    return (
      <p className="text-slate-600" role="status">
        Cargando ficha del cliente...
      </p>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" role="alert">
          No se pudo cargar la ficha: {error.message}
        </p>
        <Link to="/clientes" className="text-sm text-teal-800 hover:underline">
          Volver a clientes
        </Link>
      </div>
    );
  }

  const cliente = data.cliente;
  const pacientes = cliente.pacientes ?? [];

  function alEditarGuardado() {
    setModalEditar(false);
  }

  function alCrearPaciente() {
    setModalPaciente(false);
    queryClient.invalidateQueries({ queryKey: ['cliente', id] });
  }

  function alUnir(conservadoId) {
    setModalUnir(false);
    navegar(`/clientes/${conservadoId}`);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/clientes" className="text-sm text-teal-800 hover:underline">
            ← Volver a clientes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {cliente.apellido}, {cliente.nombre}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {cliente.tipoDocumento} {cliente.nroDocumento}
            {cliente.fichaIncompleta && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                Ficha incompleta
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setModalEditar(true)}
          >
            Editar cliente
          </button>
          <button
            type="button"
            className="rounded bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => setModalPaciente(true)}
          >
            Nuevo paciente
          </button>
          {esAdmin && !cliente.fusionadoEnClienteId && (
            <button
              type="button"
              className="rounded border border-amber-300 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50"
              onClick={() => setModalUnir(true)}
            >
              Unir duplicado
            </button>
          )}
        </div>
      </div>

      {cliente.fusionadoEnClienteId && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Este cliente fue fusionado con{' '}
          <Link to={`/clientes/${cliente.fusionadoEnClienteId}`} className="font-medium underline">
            otro cliente
          </Link>
          .
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">Contacto</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Teléfono principal">
              {cliente.telefonoPrincipal ?? '—'}
              {cliente.telefonoEsWhatsapp && (
                <span className="ml-1 text-xs text-emerald-700">WhatsApp</span>
              )}
            </Dato>
            <Dato etiqueta="Teléfono alternativo">{cliente.telefonoAlternativo ?? '—'}</Dato>
            <Dato etiqueta="Email">{cliente.email ?? '—'}</Dato>
            <Dato etiqueta="Dirección">{cliente.calleNumero ?? '—'}</Dato>
            <Dato etiqueta="Localidad o barrio">{cliente.localidadBarrio ?? '—'}</Dato>
            <Dato etiqueta="Provincia">{cliente.provincia ?? '—'}</Dato>
            <Dato etiqueta="País">{cliente.pais ?? '—'}</Dato>
            <Dato etiqueta="Fecha de consentimiento">
              {cliente.fechaConsentimiento ? formatearFecha(cliente.fechaConsentimiento) : '—'}
            </Dato>
          </dl>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Consentimiento</h2>
          <p className="text-sm text-slate-700">
            Correo: {cliente.aceptaCorreo ? 'Acepta' : 'No acepta'}
          </p>
          <p className="text-sm text-slate-700">
            WhatsApp: {cliente.aceptaWhatsapp ? 'Acepta' : 'No acepta'}
          </p>
          <p className="text-xs text-slate-500">
            Alta: {formatearFecha(cliente.creadoEn)}
            <br />
            Última edición: {formatearFecha(cliente.actualizadoEn)}
          </p>
        </div>
      </div>

      {cliente.observaciones && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Observaciones</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{cliente.observaciones}</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Pacientes</h2>
          <p className="text-sm text-slate-600">
            {pacientes.length} mascota{pacientes.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Especie</th>
                <th className="px-4 py-3">Raza</th>
                <th className="px-4 py-3">Sexo</th>
                <th className="px-4 py-3">Edad</th>
                <th className="px-4 py-3">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pacientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Todavía no tiene pacientes cargados.
                  </td>
                </tr>
              )}

              {pacientes.map((paciente) => (
                <tr key={paciente.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {paciente.codigoInterno}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/pacientes/${paciente.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {paciente.nombre}
                    </Link>
                    {paciente.fechaDeceso && (
                      <span className="ml-2 text-xs text-slate-500">Fallecido</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{paciente.especieNombre}</td>
                  <td className="px-4 py-3 text-slate-600">{paciente.razaNombre ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{paciente.sexo}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {paciente.fechaNacimiento ? calcularEdad(paciente.fechaNacimiento) || '—' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        paciente.fichaIncompleta
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700',
                      ].join(' ')}
                    >
                      {paciente.fichaIncompleta ? 'Incompleta' : 'Completa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal abierto={modalEditar} titulo="Editar cliente" onCerrar={() => setModalEditar(false)}>
        <FormularioCliente
          cliente={cliente}
          onGuardado={alEditarGuardado}
          onCancelar={() => setModalEditar(false)}
        />
      </Modal>

      <Modal
        abierto={modalPaciente}
        titulo="Nuevo paciente"
        onCerrar={() => setModalPaciente(false)}
      >
        <FormularioPaciente
          cliente={{ id: cliente.id, nombreCompleto: `${cliente.nombre} ${cliente.apellido}` }}
          onGuardado={alCrearPaciente}
          onCancelar={() => setModalPaciente(false)}
        />
      </Modal>

      <Modal
        abierto={modalUnir}
        titulo="Unir cliente duplicado"
        onCerrar={() => setModalUnir(false)}
      >
        <UnirCliente cliente={cliente} onUnido={alUnir} onCancelar={() => setModalUnir(false)} />
      </Modal>
    </section>
  );
}
