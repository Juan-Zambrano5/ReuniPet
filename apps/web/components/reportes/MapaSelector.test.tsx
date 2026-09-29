import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapaSelector, type PuntoMapa } from '@/components/reportes/MapaSelector';

function stubRect(el: HTMLElement): void {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('MapaSelector (HU9 AC1 — mock clicable)', () => {
  it('renderiza el mapa con su punto de partida', () => {
    render(<MapaSelector value={null} onChange={jest.fn()} />);
    expect(screen.getByTestId('mapa-mock')).toBeInTheDocument();
    expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
      'Aún no has marcado un punto',
    );
  });

  it('al hacer clic emite las coordenadas del punto dentro del bounding box', () => {
    const onChange = jest.fn();
    render(<MapaSelector value={null} onChange={onChange} />);

    const mapa = screen.getByTestId('mapa-mock');
    stubRect(mapa);
    fireEvent.click(mapa, { clientX: 100, clientY: 100 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const punto: PuntoMapa = onChange.mock.calls[0][0];
    // Esquina inferior-derecha del bbox simulado.
    expect(punto.lat).toBeCloseTo(10.4, 5);
    expect(punto.lng).toBeCloseTo(-66.85, 5);
  });

  it('el clic en la esquina superior-izquierda devuelve lat norte y lng oeste', () => {
    const onChange = jest.fn();
    render(<MapaSelector value={null} onChange={onChange} />);

    const mapa = screen.getByTestId('mapa-mock');
    stubRect(mapa);
    fireEvent.click(mapa, { clientX: 0, clientY: 0 });

    const punto: PuntoMapa = onChange.mock.calls[0][0];
    expect(punto.lat).toBeCloseTo(10.5, 5);
    expect(punto.lng).toBeCloseTo(-66.95, 5);
  });

  it('marca el centro con Enter (accesible por teclado)', () => {
    const onChange = jest.fn();
    render(<MapaSelector value={null} onChange={onChange} />);

    fireEvent.keyDown(screen.getByTestId('mapa-mock'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ lat: 10.45, lng: -66.9 });
  });

  it('con un punto marcado muestra el pin y las coordenadas', () => {
    render(
      <MapaSelector value={{ lat: 10.45, lng: -66.9 }} onChange={jest.fn()} />,
    );

    expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
      'Punto marcado: 10.45, -66.9',
    );
    expect(screen.queryByText('Haz clic para marcar')).not.toBeInTheDocument();
  });

  it('el mapa es enfocable y declara su rol de botón', () => {
    render(<MapaSelector value={null} onChange={jest.fn()} />);
    const mapa = screen.getByRole('button');
    expect(mapa).toHaveAttribute('tabindex', '0');
    expect(mapa).toHaveAccessibleName(/marca la ubicación/i);
  });
});
