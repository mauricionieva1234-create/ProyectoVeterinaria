import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { obtenerCliente, unirClientes } from '../api/clientes.js';
import { FormularioCliente } from '../componentes/FormularioCliente.jsx';
import { FormularioIngreso } from '../componentes/FormularioIngreso.jsx';
import { FormularioPaciente } from '../componentes/FormularioPaciente.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezado, claseBotonEncabezadoSolido } from '../componentes/tonos.js';
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
  const puedeAgregarACola = (sesion?.permisos ?? []).includes('cola.crear');

  const [modalEditar, setModalEditar] = useState(false);
  const [modalPaciente, setModalPaciente] = useState(false);
  const [modalUnir, setModalUnir] = useState(false);
  const [pacienteParaCola, setPacienteParaCola] = useState(null);
  const [eligiendoServicio, setEligiendoServicio] = useState(false);
  const [avisoCola, setAvisoCola] = useState(null);

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

  function alCrearPaciente(paciente) {
    setModalPaciente(false);
    queryClient.invalidateQueries({ queryKey: ['cliente', id] });

    // Después de cargar una mascota se ofrece sumarla a la cola del día. Si el
    // usuario no puede crear ingresos o la mascota falleció, no se pregunta.
    if (puedeAgregarACola && paciente && !paciente.fechaDeceso) {
      setPacienteParaCola(paciente);
    }
  }

  function cerrarModalCola() {
    setPacienteParaCola(null);
    setEligiendoServicio(false);
  }

  function alAgregarACola() {
    const nombre = pacienteParaCola?.nombre ?? 'El paciente';
    cerrarModalCola();
    setAvisoCola(`${nombre} se agregó a la lista de espera.`);
  }

  function alUnir(conservadoId) {
    setModalUnir(false);
    navegar(`/clientes/${conservadoId}`);
  }

  return (
    <section className="space-y-5">
      <Link to="/clientes" className="text-sm font-medium text-sky-800 hover:underline">
        ← Volver a clientes
      </Link>
      <EncabezadoPagina
        tono="sky"
        titulo={`${cliente.apellido}, ${cliente.nombre}`}
        descripcion={
          <>
            {cliente.tipoDocumento} {cliente.nroDocumento}
            {cliente.fichaIncompleta && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                Ficha incompleta
              </span>
            )}
          </>
        }
      >
        <button type="button" className={claseBotonEncabezado} onClick={() => setModalEditar(true)}>
          Editar cliente
        </button>
        <button
          type="button"
          className={claseBotonEncabezadoSolido}
          onClick={() => setModalPaciente(true)}
        >
          Nuevo paciente
        </button>
        {esAdmin && !cliente.fusionadoEnClienteId && (
          <button type="button" className={claseBotonEncabezado} onClick={() => setModalUnir(true)}>
            Unir duplicado
          </button>
        )}
      </EncabezadoPagina>

      {cliente.fusionadoEnClienteId && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Este cliente fue fusionado con{' '}
          <Link to={`/clientes/${cliente.fusionadoEnClienteId}`} className="font-medium underline">
            otro cliente
          </Link>
          .
        </p>
      )}

      {avisoCola && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {avisoCola}{' '}
          <Link to="/cola" className="font-medium underline" onClick={() => setAvisoCola(null)}>
            Ver la cola del día
          </Link>
          .
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel tono="sky" titulo="Contacto" className="lg:col-span-2" cuerpoClassName="space-y-4">
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
        </Panel>

        <Panel tono="sky" titulo="Consentimiento" cuerpoClassName="space-y-3">
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
        </Panel>
      </div>

      {cliente.observaciones && (
        <Panel tono="sky" titulo="Observaciones">
          <p className="whitespace-pre-line text-sm text-slate-700">{cliente.observaciones}</p>
        </Panel>
      )}

      <Panel
        tono="sky"
        titulo="Pacientes"
        descripcion={`${pacientes.length} mascota${pacientes.length === 1 ? '' : 's'}`}
        cuerpoClassName="p-0"
      >
        <div className="overflow-x-auto rounded-b-2xl bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-sky-100/70 text-left text-xs uppercase tracking-wide text-sky-900">
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
      </Panel>

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

      <Modal
        abierto={Boolean(pacienteParaCola)}
        titulo={eligiendoServicio ? 'Agregar a la lista de espera' : 'Lista de espera'}
        onCerrar={cerrarModalCola}
      >
        {eligiendoServicio ? (
          <FormularioIngreso
            pacienteInicial={pacienteParaCola}
            onCreado={alAgregarACola}
            onCancelar={cerrarModalCola}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              ¿Querés ingresar a{' '}
              <span className="font-medium text-slate-900">{pacienteParaCola?.nombre}</span> a la
              lista de espera de hoy?
            </p>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                onClick={cerrarModalCola}
              >
                Ahora no
              </button>
              <button
                type="button"
                className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                onClick={() => setEligiendoServicio(true)}
              >
                Sí, agregar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
