import type { Readable } from 'stream';
import type { ChildProcess } from 'child_process';

export class DisposableTranscodeStream implements Disposable {
  constructor(
    public readonly stream: Readable, // OpenAI로 보낼 출력 스트림 (stdout)
    private readonly process: ChildProcess, // 제어할 FFmpeg 프로세스
    public readonly processPromise: Promise<void> // 프로세스 완료/에러 감지용
  ) {}

  [Symbol.dispose]() {
    if (this.stream && !this.stream.destroyed) {
      this.stream.destroy();
    }

    if (this.process && this.process.exitCode === null && !this.process.killed) {
      this.process.kill(); 
    }
  }
}