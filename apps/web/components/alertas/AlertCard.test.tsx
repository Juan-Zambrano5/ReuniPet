import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertCard } from '@/components/alertas/AlertCard';

describe('AlertCard (HU4)', () => {
  const props = {
    mensaje:
      'Tu mascota "Perro Negro" coincide en 100% con un reporte encontrado',
    tiempo: 'hace 5 minutos',
    descripcionReporte: 'Reporte perdido: Perro — Negro.',
    onVer: jest.fn(),
    onDescartar: jest.fn(),
  };

  beforeEach(() => {
    props.onVer.mockClear();
    props.onDescartar.mockClear();
  });

  it('muestra el mensaje de coincidencia, el tiempo y la descripción del reporte', () => {
    render(<AlertCard {...props} />);
    expect(
      screen.getByText(/coincide en 100% con un reporte encontrado/i),
    ).toBeInTheDocument();
    expect(screen.getByText('hace 5 minutos')).toBeInTheDocument();
    expect(screen.getByText(/Reporte perdido: Perro/)).toBeInTheDocument();
  });

  it('HU4 CA: "Ver coincidencia" dispara onVer', () => {
    render(<AlertCard {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /ver coincidencia/i }));
    expect(props.onVer).toHaveBeenCalledTimes(1);
  });

  it('HU4 CA: "Descartar" dispara onDescartar', () => {
    render(<AlertCard {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(props.onDescartar).toHaveBeenCalledTimes(1);
  });
});
