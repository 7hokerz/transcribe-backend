import PQueue from 'p-queue';
import type FFprobeService from '../service/ffprobe.service.js';
import type { JobQueue } from './queue.interface.js';
import type { FFprobeJob } from './message/ffprobe.job.js';
import type { AudioValidationResult } from '../types/audio-validation-result.js';

export default class FFprobeQueue implements JobQueue<FFprobeJob, AudioValidationResult> {
  private readonly queue: PQueue;

  constructor(
    private readonly ffprobeSvc: FFprobeService,
  ) {
    this.queue = new PQueue({
      concurrency: 2,     // 동시성
      intervalCap: 4,     // interval (ms) 동안 가능한 최대 작업의 개수 (rate-limit)
      interval: 1_000,
    });
  }

  public async enqueue(job: FFprobeJob): Promise<AudioValidationResult> {
    const { path, index, generation, contentType } = job;

    return await this.queue.add(
      () => this.ffprobeSvc.validateAudioFile(path, index, generation, contentType)
    );
  }
}