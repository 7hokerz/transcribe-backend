import PQueue from 'p-queue';
import type FFprobeService from '#services/ffprobe.service.js';
import type { JobQueue } from './queue.interface.js';
import type { FFprobeJob } from '#dtos/transcribe.dto.js';

export default class FFprobeQueue implements JobQueue<FFprobeJob> {
  private readonly queue: PQueue;

  constructor(
    private readonly svc: FFprobeService,
  ) {
    this.queue = new PQueue({
      concurrency: 2,     // 동시성
      intervalCap: 4,     // interval (ms) 동안 가능한 최대 작업의 개수 (rate-limit)
      interval: 1_000,
    });
  }

  public async enqueue(job: FFprobeJob): Promise<number> {
    const { audioPath, index, generation } = job;

    return await this.queue.add(
      () => this.svc.validateAudioFile(audioPath, index, generation)
    );
  }
}