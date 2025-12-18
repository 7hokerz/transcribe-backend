import PQueue from 'p-queue';
import type SessionService from '../service/session.service.js';
import type { JobQueue } from './queue.interface.js';
import type { TranscriptSession } from './message/transcription.session.job.js';

export default class SessionQueue implements JobQueue<TranscriptSession, void> {
  private readonly queue: PQueue;

  constructor(
    private readonly svc: SessionService,
  ) {
    this.queue = new PQueue({
      concurrency: 10,    // 동시성
      intervalCap: 20,    // interval (ms) 동안 가능한 최대 작업의 개수 (rate-limit)
      interval: 1000,
    });
  }

  public async enqueue(input: TranscriptSession): Promise<void> {
    this.queue.add(() => this.svc.process(input))
      .catch(e => {
        console.error(`[Queue Job ${input.sessionId} failed before entering worker]`, e);
      });
  }
}
