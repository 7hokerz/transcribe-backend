
import type { GCSBucket } from '#config/firebase-admin.js'
import type { AudioChunkRef, AudioStream } from '#types/storage.types.ts';

export default class GcsStorageClient {

  constructor(private readonly bucket: GCSBucket) { }

  // 전체 파일 리스트 획득
  public async getFiles(prefix: string, options?: { maxResults?: number }): Promise<AudioChunkRef[]> {
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

  // 개별 파일 스트림 획득
  public openReadStream(path: string, generation: string, options: { validation: boolean | "crc32c" }): AudioStream {
    const file = this.bucket.file(path, { generation });

    const sizeBytes = file.metadata?.size ? Number(file.metadata.size) : undefined;

    const stream = file.createReadStream({ validation: options.validation });

    return { stream, sizeBytes };
  }
}