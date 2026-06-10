export interface StorageDriver {
  put(path: string, buffer: Buffer, mimetype: string): Promise<void>;
  delete(path: string): Promise<void>;
  url(path: string): string;
}
