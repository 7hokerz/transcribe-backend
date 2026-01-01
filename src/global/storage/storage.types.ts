import type { Readable } from 'stream';

export interface FileReference {
  /** 스토리지 객체 이름 */
  name: string;

  /** 스토리지 객체 generation(버전 식별자) */
  generation: string;
}

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
