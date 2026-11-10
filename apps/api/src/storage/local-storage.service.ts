import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { StorageService } from './storage.service';

/**
 * Carpeta de las fotos. UPLOADS_DIR la cambia (las e2e usan uploads-test);
 * se lee al usarla para respetar también la que cargue ConfigModule del .env.
 */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
}
export const FILES_PREFIX = '/files';

@Injectable()
export class LocalStorageService implements StorageService {
  async save(buffer: Buffer, filename: string): Promise<string> {
    const dir = uploadsDir();
    await mkdir(dir, { recursive: true });
    const path = join(dir, filename);
    await writeFile(path, buffer);
    return `${FILES_PREFIX}/${filename}`;
  }
}
