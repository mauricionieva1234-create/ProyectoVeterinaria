import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '../componentes/Layout.jsx';
import { RutaAdmin } from '../componentes/RutaAdmin.jsx';
import { RutaPermiso } from '../componentes/RutaPermiso.jsx';
import { RutaProtegida } from '../componentes/RutaProtegida.jsx';
import { Auditoria } from '../paginas/Auditoria.jsx';
import { Caja } from '../paginas/Caja.jsx';
import { Catalogos } from '../paginas/Catalogos.jsx';
import { Clientes } from '../paginas/Clientes.jsx';
import { Cola } from '../paginas/Cola.jsx';
import { Controles } from '../paginas/Controles.jsx';
import { FichaCliente } from '../paginas/FichaCliente.jsx';
import { FichaPaciente } from '../paginas/FichaPaciente.jsx';
import { FichasIncompletas } from '../paginas/FichasIncompletas.jsx';
import { HistoriaClinica } from '../paginas/HistoriaClinica.jsx';
import { IngresosSinCerrar } from '../paginas/IngresosSinCerrar.jsx';
import { Inicio } from '../paginas/Inicio.jsx';
import { Login } from '../paginas/Login.jsx';
import { NoAutorizado } from '../paginas/NoAutorizado.jsx';
import { NoEncontrada } from '../paginas/NoEncontrada.jsx';
import { Usuarios } from '../paginas/Usuarios.jsx';
import { Visita } from '../paginas/Visita.jsx';
import { Visitas } from '../paginas/Visitas.jsx';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
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
