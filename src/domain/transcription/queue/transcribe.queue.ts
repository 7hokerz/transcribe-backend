import PQueue from 'p-queue';
import pRetry from 'p-retry';
import type GcsStorageClient from '#global/storage/gcs-storage.client.js';
import type TranscribeService from '../service/transcribe.service.js';
import type { JobQueue } from './queue.interface.js';
import type { TranscriptionJob } from './message/transcription.job.js';
import type { TranscriptionSegment } from '../types/transcription-segment.js';

export default class TranscribeQueue implements JobQueue<TranscriptionJob, TranscriptionSegment> {
  private readonly queue: PQueue;

  constructor(
    private readonly storage: GcsStorageClient,
    private readonly transcribeSvc: TranscribeService,
  ) {
    this.queue = new PQueue({
      concurrency: 10,    // 동시성
      intervalCap: 20,    // interval (ms) 동안 가능한 최대 작업의 개수 (rate-limit)
      interval: 1_000,
    });
  }

  public async enqueue(job: TranscriptionJob): Promise<TranscriptionSegment> {
    const { path, generation, duration, transcriptionPrompt } = job;

    return await this.queue.add(() =>
      pRetry(async () => {
        const fileName = path.split("/").pop() ?? 'unknown';

        using fileStream = this.storage.openReadStream(path, generation, { validation: 'crc32c' });

        return await this.transcribeSvc.transcribeAudio(fileStream.stream, fileName, transcriptionPrompt, fileStream.sizeBytes);
      }, {
        retries: 2,
        factor: 2,
        minTimeout: 2_000,
        maxTimeout: 10_000,
      }), {
      priority: -duration
    });
  }
}

