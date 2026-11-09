import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '../componentes/Layout.jsx';
import { RutaAdmin } from '../componentes/RutaAdmin.jsx';
import { RutaProtegida } from '../componentes/RutaProtegida.jsx';
import { Auditoria } from '../paginas/Auditoria.jsx';
import { Catalogos } from '../paginas/Catalogos.jsx';
import { Clientes } from '../paginas/Clientes.jsx';
import { FichaCliente } from '../paginas/FichaCliente.jsx';
import { FichaPaciente } from '../paginas/FichaPaciente.jsx';
import { FichasIncompletas } from '../paginas/FichasIncompletas.jsx';
import { Inicio } from '../paginas/Inicio.jsx';
import { Login } from '../paginas/Login.jsx';
import { NoAutorizado } from '../paginas/NoAutorizado.jsx';
import { NoEncontrada } from '../paginas/NoEncontrada.jsx';
import { Usuarios } from '../paginas/Usuarios.jsx';

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
      { path: 'clientes', element: <Clientes /> },
      { path: 'clientes/:id', element: <FichaCliente /> },
      { path: 'pacientes/:id', element: <FichaPaciente /> },
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
