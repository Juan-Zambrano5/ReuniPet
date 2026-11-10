import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { FotoReporte } from '@/components/fotos/FotoReporte';

describe('FotoReporte (foto que falla)', () => {
  it('muestra la imagen mientras carga bien', () => {
    render(<FotoReporte src="/files/a.jpg" alt="Foto de perro" />);
    expect(screen.getByRole('img', { name: 'Foto de perro' })).toHaveAttribute(
      'src',
      '/files/a.jpg',
    );
    expect(screen.queryByText('Foto no disponible')).not.toBeInTheDocument();
  });

  it('si la imagen da error (404) muestra "Foto no disponible"', () => {
    render(
      <FotoReporte src="/files/borrada.jpg" alt="Foto de perro" data-testid="foto" />,
    );
    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByText('Foto no disponible')).toBeInTheDocument();
    const respaldo = screen.getByRole('img', {
      name: 'Foto de perro: foto no disponible',
    });
    expect(respaldo).toHaveAttribute('data-testid', 'foto');
    expect(respaldo.tagName).toBe('DIV');
  });

  it('en miniatura solo muestra el icono, con nombre accesible', () => {
    render(<FotoReporte src="/files/x.jpg" alt="" compacta />);
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.queryByText('Foto no disponible')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Foto no disponible' }),
    ).toBeInTheDocument();
  });

  it('al cambiar de foto vuelve a intentar cargarla', () => {
    const { rerender } = render(<FotoReporte src="/files/1.jpg" alt="Foto 1" />);
    fireEvent.error(screen.getByRole('img'));
    rerender(<FotoReporte src="/files/2.jpg" alt="Foto 2" />);
    expect(screen.getByRole('img', { name: 'Foto 2' })).toHaveAttribute(
      'src',
      '/files/2.jpg',
    );
  });
});
