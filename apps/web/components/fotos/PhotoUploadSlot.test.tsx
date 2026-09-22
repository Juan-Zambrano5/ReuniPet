import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoUploadSlot } from '@/components/fotos/PhotoUploadSlot';

describe('PhotoUploadSlot (HU2)', () => {
  it('muestra el estado vacío con el ícono +', () => {
    render(
      <PhotoUploadSlot
        slotId="1"
        onSelect={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(screen.getByTestId('slot-1')).toBeInTheDocument();
    expect(screen.getByTestId('input-1')).toBeInTheDocument();
  });

  it('muestra la preview cuando hay URL', () => {
    render(
      <PhotoUploadSlot
        slotId="2"
        previewUrl="blob:http://localhost/fake"
        onSelect={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(
      screen.getByAltText(/vista previa de la fotografía 2/i),
    ).toBeInTheDocument();
  });

  it('muestra ErrorText cuando el archivo es inválido', () => {
    render(
      <PhotoUploadSlot
        slotId="3"
        error="El archivo no es una imagen JPG, PNG o WEBP válida"
        onSelect={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(
      screen.getByText(/no es una imagen JPG, PNG o WEBP/i),
    ).toBeInTheDocument();
  });

  it('entrega el archivo seleccionado al padre', () => {
    const onSelect = jest.fn();
    render(
      <PhotoUploadSlot slotId="4" onSelect={onSelect} onClear={jest.fn()} />,
    );
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('input-4'), { target: { files: [file] } });
    expect(onSelect).toHaveBeenCalledWith(file);
  });
});
