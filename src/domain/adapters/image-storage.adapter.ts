export abstract class ImageStorageAdapter {
  abstract upload(key: string, data: Buffer, mimeType: string): Promise<string>;
}
