import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cambiarEstadoUsuario, listarUsuarios } from '../api/usuarios.js';
import { FormularioUsuario } from '../componentes/FormularioUsuario.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezadoSolido } from '../componentes/tonos.js';
import { etiquetaRol } from '../utils/roles.js';

const LIMITE = 10;

export function Usuarios() {
  const queryClient = useQueryClient();

  const [filtros, setFiltros] = useState({
    pagina: 1,
    limite: LIMITE,
    buscar: '',
    rol: '',
    activo: '',
  });
  const [textoBuscar, setTextoBuscar] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['usuarios', filtros],
    queryFn: () => listarUsuarios(filtros),
    placeholderData: keepPreviousData,
  });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, activo }) => cambiarEstadoUsuario(id, activo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  function actualizarFiltro(cambio) {
    setFiltros((actuales) => ({ ...actuales, ...cambio, pagina: 1 }));
  }

  function alBuscar(evento) {
    evento.preventDefault();
    actualizarFiltro({ buscar: textoBuscar.trim() });
  }

  function abrirAlta() {
    setUsuarioEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(usuario) {
    setUsuarioEnEdicion(usuario);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setUsuarioEnEdicion(null);
  }

  function alCambiarEstado(usuario) {
    const accion = usuario.activo ? 'desactivar' : 'activar';
    const confirmado = window.confirm(`¿Seguro que querés ${accion} a ${usuario.nombreCompleto}?`);

    if (!confirmado) return;

    cambiarEstado.mutate({ id: usuario.id, activo: !usuario.activo });
  }

  const usuarios = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="slate"
        titulo="Usuarios"
        descripcion="Alta, edición y activación de cuentas del sistema."
      >
        <button type="button" className={claseBotonEncabezadoSolido} onClick={abrirAlta}>
          Nuevo usuario
        </button>
      </EncabezadoPagina>

      <Panel tono="slate">
        <form className="flex flex-wrap items-end gap-3" onSubmit={alBuscar}>
          <div className="min-w-48 flex-1">
            <label htmlFor="buscar" className="block text-xs font-medium text-slate-600">
              Buscar por nombre o email
            </label>
            <input
              id="buscar"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={textoBuscar}
              onChange={(evento) => setTextoBuscar(evento.target.value)}
              placeholder="Ej.: veterinario"
            />
          </div>

          <div>
            <label htmlFor="filtro-rol" className="block text-xs font-medium text-slate-600">
              Rol
            </label>
            <select
              id="filtro-rol"
              className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
              value={filtros.rol}
              onChange={(evento) => actualizarFiltro({ rol: evento.target.value })}
            >
              <option value="">Todos</option>
              <option value="admin">Administrador</option>
              <option value="veterinario">Veterinario</option>
              <option value="recepcion">Recepción</option>
            </select>
          </div>

          <div>
            <label htmlFor="filtro-estado" className="block text-xs font-medium text-slate-600">
              Estado
            </label>
            <select
              id="filtro-estado"
              className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
              value={filtros.activo}
              onChange={(evento) => actualizarFiltro({ activo: evento.target.value })}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>

          <button
            type="submit"
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Buscar
          </button>
        </form>
      </Panel>

      {cambiarEstado.isError && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {cambiarEstado.error.message}
        </p>
      )}

      <Panel tono="slate" titulo="Cuentas del sistema" cuerpoClassName="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-200/70 text-left text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isPending && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Cargando usuarios...
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-red-700" role="alert">
                    No se pudieron cargar los usuarios: {error.message}
                  </td>
                </tr>
              )}

              {!isPending && !isError && usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No hay usuarios que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{usuario.nombreCompleto}</td>
                  <td className="px-4 py-3 text-slate-600">{usuario.email}</td>
                  <td className="px-4 py-3 text-slate-600">{etiquetaRol(usuario.rol)}</td>
                  <td className="px-4 py-3 text-slate-600">{usuario.matricula ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        usuario.activo
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600',
                      ].join(' ')}
                    >
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        onClick={() => abrirEdicion(usuario)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        onClick={() => alCambiarEstado(usuario)}
                        disabled={cambiarEstado.isPending}
                      >
                        {usuario.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
          <p>
            {paginacion
              ? `${paginacion.total} usuario${paginacion.total === 1 ? '' : 's'} en total`
              : 'Sin datos'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() =>
                setFiltros((actuales) => ({ ...actuales, pagina: actuales.pagina - 1 }))
              }
              disabled={!paginacion || paginacion.pagina <= 1}
            >
              Anterior
            </button>
            <span>
              Página {paginacion?.pagina ?? 1} de {paginacion?.totalPaginas ?? 1}
            </span>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() =>
                setFiltros((actuales) => ({ ...actuales, pagina: actuales.pagina + 1 }))
              }
              disabled={!paginacion || paginacion.pagina >= paginacion.totalPaginas}
            >
              Siguiente
            </button>
          </div>
        </div>
      </Panel>

      <Modal
        abierto={modalAbierto}
        titulo={usuarioEnEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        onCerrar={cerrarModal}
      >
        <FormularioUsuario
          usuario={usuarioEnEdicion}
          onGuardado={cerrarModal}
          onCancelar={cerrarModal}
        />
      </Modal>
    </section>
  );
}
