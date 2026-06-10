import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { StorageDriver } from './storage-driver.interface';

export interface S3DriverOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
  forcePathStyle: boolean;
}

export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(private readonly options: S3DriverOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async put(path: string, buffer: Buffer, mimetype: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: path,
        Body: buffer,
        ContentType: mimetype,
      }),
    );
  }

  async delete(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.options.bucket,
        Key: path,
      }),
    );
  }

  url(path: string): string {
    if (this.options.publicUrl) {
      return `${this.options.publicUrl.replace(/\/$/, '')}/${path}`;
    }

    if (this.options.endpoint) {
      return `${this.options.endpoint.replace(/\/$/, '')}/${this.options.bucket}/${path}`;
    }

    return `https://${this.options.bucket}.s3.${this.options.region}.amazonaws.com/${path}`;
  }
}
