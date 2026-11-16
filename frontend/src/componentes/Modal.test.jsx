import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Modal } from './Modal.jsx';

function Ejemplo() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setAbierto(true)}>
        Abrir
      </button>

      <Modal abierto={abierto} titulo="Prueba" onCerrar={() => setAbierto(false)}>
        <label htmlFor="campo">Campo</label>
        <input id="campo" />
        <button type="button" onClick={() => setAbierto(false)}>
          Guardar
        </button>
      </Modal>
    </div>
  );
}

afterEach(cleanup);

describe('Modal', () => {
  it('atrapa el foco dentro del diálogo y lo devuelve al cerrar', async () => {
    const usuario = userEvent.setup();
    render(<Ejemplo />);

    const abrir = screen.getByRole('button', { name: 'Abrir' });
    await usuario.click(abrir);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();

    // Tab recorre los controles y vuelve al primero al llegar al final.
    await usuario.tab();
    expect(screen.getByLabelText('Campo')).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();

    // Shift+Tab desde el primero va al último.
    await usuario.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });
});
