export const StorageService = Symbol('StorageService');

export interface StorageService {
  save(buffer: Buffer, filename: string): Promise<string>;
}
