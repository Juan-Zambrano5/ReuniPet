import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { StorageService } from './storage.service';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const FILES_PREFIX = '/files';

@Injectable()
export class LocalStorageService implements StorageService {
  async save(buffer: Buffer, filename: string): Promise<string> {
    await mkdir(UPLOADS_DIR, { recursive: true });
    const path = join(UPLOADS_DIR, filename);
    await writeFile(path, buffer);
    return `${FILES_PREFIX}/${filename}`;
  }
}
