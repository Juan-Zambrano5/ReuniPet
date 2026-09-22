import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { FotosService, MAX_PHOTO_BYTES } from './fotos.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function makeFile(buffer: Buffer, name = 'foto.png'): Express.Multer.File {
  return {
    fieldname: 'fotos',
    originalname: name,
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.length,
    buffer,
    stream: undefined,
  } as unknown as Express.Multer.File;
}

describe('FotosService (HU2)', () => {
  let service: FotosService;
  let prismaMock: {
    reporte: { findUnique: jest.Mock };
    fotografia: { create: jest.Mock };
  };
  let storageMock: { save: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      reporte: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rep-1',
          fotos: [{ orden: 2 }],
        }),
      },
      fotografia: { create: jest.fn() },
    };
    storageMock = { save: jest.fn().mockResolvedValue('/files/x.png') };
    service = new FotosService(
      prismaMock as unknown as PrismaService,
      storageMock as unknown as StorageService,
    );
  });

  it('agrega fotos sin borrar las existentes (AC3) y continúa el orden', async () => {
    prismaMock.fotografia.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'f', ...data, createdAt: new Date() }),
    );

    const result = await service.addFotos('rep-1', [makeFile(PNG_1x1)]);

    expect(storageMock.save).toHaveBeenCalledTimes(1);
    expect(prismaMock.fotografia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reporteId: 'rep-1', orden: 3 }),
    });
    expect(result).toHaveLength(1);
    // nunca se borran fotos
    expect(prismaMock.reporte).not.toHaveProperty('deleteMany');
  });

  it('rechaza un archivo que no es imagen válida con 400 (AC2)', async () => {
    const fake = Buffer.from('esto no es una imagen, es texto plano');
    await expect(service.addFotos('rep-1', [makeFile(fake, 'mal.txt')])).rejects.toThrow(
      BadRequestException,
    );
    expect(storageMock.save).not.toHaveBeenCalled();
  });

  it('rechaza archivos mayores a 5MB (RNF-02)', async () => {
    const big = Buffer.concat([PNG_1x1, Buffer.alloc(MAX_PHOTO_BYTES)]);
    await expect(service.addFotos('rep-1', [makeFile(big)])).rejects.toThrow(/5MB/);
  });

  it('redimensiona a un máximo de 1600px en el lado más largo (RNF-02)', async () => {
    const grande = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();

    storageMock.save.mockImplementation(async (buffer: Buffer) => {
      const meta = await sharp(buffer).metadata();
      expect(meta.width).toBeLessThanOrEqual(1600);
      expect(meta.height).toBeLessThanOrEqual(1600);
      expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
      return '/files/resized.png';
    });

    await service.addFotos('rep-1', [makeFile(grande)]);
    expect(storageMock.save).toHaveBeenCalledTimes(1);
  });

  it('devuelve 400 si no se envía ningún archivo', async () => {
    await expect(service.addFotos('rep-1', [])).rejects.toThrow(BadRequestException);
  });

  it('devuelve 400 si el reporte no existe', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(null);
    await expect(service.addFotos('no-existe', [makeFile(PNG_1x1)])).rejects.toThrow(
      'El reporte no existe',
    );
  });
});
