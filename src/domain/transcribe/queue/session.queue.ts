import PQueue from 'p-queue';
import type SessionService from '../service/session.service.js';
import type { JobQueue } from './queue.interface.js';
import type { TranscriptSessionJob } from './message/transcription.session.job.js';

export default class SessionQueue implements JobQueue<TranscriptSessionJob, void> {
  private readonly queue: PQueue;

  constructor(
    private readonly sessionSvc: SessionService,
  ) {
    this.queue = new PQueue({
      concurrency: 10,    // 동시성
      intervalCap: 20,    // interval (ms) 동안 가능한 최대 작업의 개수 (rate-limit)
      interval: 1000,
    });
  }

  public async enqueue(input: TranscriptSessionJob): Promise<void> {
    this.queue.add(() => this.sessionSvc.process(input))
      .catch(e => {
        console.error(`[Queue Job ${input.sessionId} failed before entering worker]`, e);
      });
  }
}
