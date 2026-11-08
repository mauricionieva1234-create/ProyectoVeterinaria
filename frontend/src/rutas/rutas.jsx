import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '../componentes/Layout.jsx';
import { Inicio } from '../paginas/Inicio.jsx';
import { NoEncontrada } from '../paginas/NoEncontrada.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Inicio /> },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
]);
