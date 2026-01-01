
import type { GCSBucket } from '#global/config/firebase.config.js'
import { DisposableStream, type FileReference } from "./storage.types.js";

export default class GcsStorageClient {

  constructor(private readonly bucket: GCSBucket) { }

  /**
   * 전체 파일 리스트 획득
   */
  public async getFiles(prefix: string, options?: { maxResults?: number }): Promise<FileReference[]> {
    const [allObjects] = await this.bucket.getFiles({ prefix, maxResults: options?.maxResults ?? 100 });

    return allObjects
      .filter(f => !f.name.endsWith('/'))
      .sort((a, b) => {
        const ai = Number(a.metadata?.metadata?.['chunk-index'] ?? Infinity);
        const bi = Number(b.metadata?.metadata?.['chunk-index'] ?? Infinity);
        return ai !== bi ? ai - bi : a.name.localeCompare(b.name);
      })
      .map(f => ({
        name: f.name,
        generation: String(f.metadata?.generation ?? ""),
      }))
      .filter(x => x.generation.length > 0);
  }

  /**
   * 개별 파일 스트림 획득
   */
  public openReadStream(
    path: string,
    generation: string,
    options: {
      start?: number,
      end?: number,
      validation: boolean | "crc32c",
    }
  ) {
    const file = this.bucket.file(path, { generation });

    const sizeBytes = file.metadata?.size ? Number(file.metadata.size) : undefined;

    const stream = file.createReadStream({
      ...(Number.isFinite(options?.start) ? { start: options.start } : {}),
      ...(Number.isFinite(options?.end) ? { end: options.end } : {}),
      validation: options.validation
    });

    return new DisposableStream(stream, sizeBytes);
  }

  public async getSignedUrl(
    path: string,
    generation: string,
    options: {
      version: 'v2' | 'v4',
      action: 'read' | 'write' | 'delete' | 'resumable',
      expires: number,
    }
  ) {
    const [signedUrl] = await this.bucket.file(path, { generation }).getSignedUrl(options);
    return signedUrl;
  }
}