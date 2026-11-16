import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { CargandoPagina } from '../componentes/CargandoPagina.jsx';
import { Layout } from '../componentes/Layout.jsx';
import { RutaAdmin } from '../componentes/RutaAdmin.jsx';
import { RutaPermiso } from '../componentes/RutaPermiso.jsx';
import { RutaProtegida } from '../componentes/RutaProtegida.jsx';

// Cada página se carga como un paquete aparte. La app abre más rápido y el
// navegador solo descarga la pantalla que se está usando.
function diferida(cargar, nombre) {
  return lazy(() => cargar().then((modulo) => ({ default: modulo[nombre] })));
}

const Auditoria = diferida(() => import('../paginas/Auditoria.jsx'), 'Auditoria');
const Caja = diferida(() => import('../paginas/Caja.jsx'), 'Caja');
const Catalogos = diferida(() => import('../paginas/Catalogos.jsx'), 'Catalogos');
const Clientes = diferida(() => import('../paginas/Clientes.jsx'), 'Clientes');
const Cola = diferida(() => import('../paginas/Cola.jsx'), 'Cola');
const Controles = diferida(() => import('../paginas/Controles.jsx'), 'Controles');
const FichaCliente = diferida(() => import('../paginas/FichaCliente.jsx'), 'FichaCliente');
const FichaPaciente = diferida(() => import('../paginas/FichaPaciente.jsx'), 'FichaPaciente');
const FichasIncompletas = diferida(
  () => import('../paginas/FichasIncompletas.jsx'),
  'FichasIncompletas',
);
const HistoriaClinica = diferida(() => import('../paginas/HistoriaClinica.jsx'), 'HistoriaClinica');
const IngresosSinCerrar = diferida(
  () => import('../paginas/IngresosSinCerrar.jsx'),
  'IngresosSinCerrar',
);
const Inicio = diferida(() => import('../paginas/Inicio.jsx'), 'Inicio');
const Login = diferida(() => import('../paginas/Login.jsx'), 'Login');
const NoAutorizado = diferida(() => import('../paginas/NoAutorizado.jsx'), 'NoAutorizado');
const NoEncontrada = diferida(() => import('../paginas/NoEncontrada.jsx'), 'NoEncontrada');
const Precios = diferida(() => import('../paginas/Precios.jsx'), 'Precios');
const Usuarios = diferida(() => import('../paginas/Usuarios.jsx'), 'Usuarios');
const Visita = diferida(() => import('../paginas/Visita.jsx'), 'Visita');
const Visitas = diferida(() => import('../paginas/Visitas.jsx'), 'Visitas');

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<CargandoPagina />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <RutaProtegida>
        <Layout />
      </RutaProtegida>
    ),
    children: [
      { index: true, element: <Inicio /> },
      { path: 'no-autorizado', element: <NoAutorizado /> },
      { path: 'cola', element: <Cola /> },
      { path: 'cola/sin-cerrar', element: <IngresosSinCerrar /> },
      {
        path: 'caja',
        element: (
          <RutaPermiso permiso="caja.ver">
            <Caja />
          </RutaPermiso>
        ),
      },
      {
        path: 'visitas',
        element: (
          <RutaPermiso permiso="visitas.ver">
            <Visitas />
          </RutaPermiso>
        ),
      },
      {
        path: 'visitas/:id',
        element: (
          <RutaPermiso permiso="visitas.ver">
            <Visita />
          </RutaPermiso>
        ),
      },
      {
        path: 'controles',
        element: (
          <RutaPermiso permiso="controles.ver">
            <Controles />
          </RutaPermiso>
        ),
      },
      {
        path: 'precios',
        element: (
          <RutaPermiso permiso="precios.ver">
            <Precios />
          </RutaPermiso>
        ),
      },
      { path: 'clientes', element: <Clientes /> },
      { path: 'clientes/:id', element: <FichaCliente /> },
      { path: 'pacientes/:id', element: <FichaPaciente /> },
      {
        path: 'pacientes/:id/historia-clinica',
        element: (
          <RutaPermiso permiso="historia.ver">
            <HistoriaClinica />
          </RutaPermiso>
        ),
      },
      { path: 'fichas-incompletas', element: <FichasIncompletas /> },
      { path: 'catalogos', element: <Catalogos /> },
      {
        path: 'usuarios',
        element: (
          <RutaAdmin>
            <Usuarios />
          </RutaAdmin>
        ),
      },
      {
        path: 'auditoria',
        element: (
          <RutaAdmin>
            <Auditoria />
          </RutaAdmin>
        ),
      },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
]);
