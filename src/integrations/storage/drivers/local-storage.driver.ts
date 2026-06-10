import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { StorageDriver } from './storage-driver.interface';

export class LocalStorageDriver implements StorageDriver {
  constructor(
    readonly root: string,
    private readonly baseUrl: string,
  ) {}

  async put(path: string, buffer: Buffer): Promise<void> {
    const absolute = join(this.root, path);

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, buffer);
  }

  async delete(path: string): Promise<void> {
    await rm(join(this.root, path), { force: true });
  }

  url(path: string): string {
    return `${this.baseUrl}/${path}`;
  }
}
