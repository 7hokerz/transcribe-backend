import { z } from 'zod';
import type { Readable } from 'stream';

export const FileReferenceSchema = z.object({
  name: z.string()
    .trim()
    .min(1)
    .describe('스토리지 객체 이름'),

  generation: z.string()
    .trim()
    .regex(/^\d+$/)
    .describe('스토리지 객체 generation(버전 식별자)'),
}).strict();

export type FileReference = z.infer<typeof FileReferenceSchema>;

export class DisposableStream implements Disposable {
  constructor(
    public readonly stream: Readable,
    public readonly sizeBytes: number | undefined
  ) { }

  [Symbol.dispose]() {
    if (this.stream && !this.stream.destroyed) {
      this.stream.destroy();
    }
  }
}
