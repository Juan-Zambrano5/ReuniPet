import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Fotografia } from '@prisma/client';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // RNF-02: 5MB
export const MAX_DIMENSION = 1600; // RNF-02: lado más largo

type DetectedType = 'image/jpeg' | 'image/png' | 'image/webp';

function detectImageType(buffer: Buffer): DetectedType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    buffer.length >= 8 &&
    pngSignature.every((b, i) => buffer[i] === b)
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const EXTENSIONS: Record<DetectedType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class FotosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async addFotos(reporteId: string, files: Express.Multer.File[]): Promise<Fotografia[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Debes adjuntar al menos una fotografía');
    }

    const reporte = await this.prisma.reporte.findUnique({
      where: { id: reporteId },
      include: { fotos: { orderBy: { orden: 'desc' }, take: 1 } },
    });
    if (!reporte) {
      throw new BadRequestException('El reporte no existe');
    }

    let orden = reporte.fotos.length > 0 ? reporte.fotos[0].orden + 1 : 0;
    const creadas: Fotografia[] = [];

    for (const file of files) {
      // RNF-06: validar por contenido real, no por extensión
      if (file.size > MAX_PHOTO_BYTES) {
        throw new BadRequestException(
          `La fotografía "${file.originalname}" supera el máximo de 5MB (RNF-02)`,
        );
      }
      const type = detectImageType(file.buffer);
      if (!type) {
        throw new BadRequestException(
          `El archivo "${file.originalname}" no es una imagen JPG, PNG o WEBP válida`,
        );
      }

      const processed: Buffer = await sharp(file.buffer)
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();

      const filename = `${randomUUID()}.${EXTENSIONS[type]}`;
      const url = await this.storage.save(processed, filename);

      creadas.push(
        await this.prisma.fotografia.create({
          data: { reporteId, url, orden },
        }),
      );
      orden += 1;
    }

    return creadas;
  }
}
