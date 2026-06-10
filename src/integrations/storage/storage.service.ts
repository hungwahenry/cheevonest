import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ulid } from 'ulid';
import { UploadedFile } from '../../common/http/uploaded-file';
import { Env } from '../../config/env';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { S3StorageDriver } from './drivers/s3-storage.driver';
import { StorageDriver } from './drivers/storage-driver.interface';

export type StorageDisk = 'local' | 's3';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/**
 * File references are stored as "disk:path" so each file is always served and
 * deleted through the disk that owns it, even after the default disk changes.
 */
@Injectable()
export class StorageService {
  readonly localRoot: string;
  private readonly defaultDisk: StorageDisk;
  private readonly drivers: Partial<Record<StorageDisk, StorageDriver>> = {};

  constructor(config: ConfigService<Env, true>) {
    this.defaultDisk = config.get('STORAGE_DISK', { infer: true });
    this.localRoot = resolve(config.get('STORAGE_DIR', { infer: true }));

    this.drivers.local = new LocalStorageDriver(
      this.localRoot,
      `${config.get('APP_URL', { infer: true })}/storage`,
    );

    const bucket = config.get('S3_BUCKET', { infer: true });

    if (bucket) {
      this.drivers.s3 = new S3StorageDriver({
        endpoint: config.get('S3_ENDPOINT', { infer: true }),
        region: config.get('S3_REGION', { infer: true }),
        bucket,
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }) ?? '',
        secretAccessKey:
          config.get('S3_SECRET_ACCESS_KEY', { infer: true }) ?? '',
        publicUrl: config.get('S3_PUBLIC_URL', { infer: true }),
        forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      });
    }
  }

  async put(file: UploadedFile, dir: string): Promise<string> {
    const extension = EXTENSIONS[file.mimetype] ?? 'bin';
    const path = `${dir}/${ulid().toLowerCase()}.${extension}`;

    await this.driver(this.defaultDisk).put(path, file.buffer, file.mimetype);

    return `${this.defaultDisk}:${path}`;
  }

  async delete(ref: string): Promise<void> {
    const { disk, path } = this.parse(ref);

    await this.driver(disk).delete(path);
  }

  url(ref: string): string {
    const { disk, path } = this.parse(ref);

    return this.driver(disk).url(path);
  }

  private parse(ref: string): { disk: StorageDisk; path: string } {
    const separator = ref.indexOf(':');

    if (separator !== -1) {
      const disk = ref.slice(0, separator);

      if (disk === 'local' || disk === 's3') {
        return { disk, path: ref.slice(separator + 1) };
      }
    }

    return { disk: 'local', path: ref };
  }

  private driver(disk: StorageDisk): StorageDriver {
    const driver = this.drivers[disk];

    if (!driver) {
      throw new Error(`Storage disk "${disk}" is not configured.`);
    }

    return driver;
  }
}
