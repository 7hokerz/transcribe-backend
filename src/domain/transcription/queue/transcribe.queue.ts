import Bottleneck from 'bottleneck';
import type GcsStorageClient from '#global/storage/gcs-storage.client.js';
import type TranscribeService from '../service/transcribe.service.js';
import type { JobQueue } from './queue.interface.js';
import type { TranscriptionJob } from './message/transcription.job.js';
import type { TranscriptionSegment } from '../types/transcription-segment.js';
import { logger } from '#global/util/logger.js';

export default class TranscribeQueue implements JobQueue<TranscriptionJob, TranscriptionSegment> {
  private readonly limiter: Bottleneck;

  constructor(
    private readonly storage: GcsStorageClient,
    private readonly transcribeSvc: TranscribeService,
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: 20,  // 최대 동시성
      minTime: 100,       // 요청 간 간격 (ms)
    });

    this.limiter.on("failed", async (e, jobInfo) => {
      const { retryCount } = jobInfo;
      const jobId = jobInfo.options.id;

      logger.warn(`[Job Failed] ID: ${jobId} | Attempt: ${retryCount + 1} | Error: ${e}`);

      if (retryCount < 2) {
        return 2_000 * (retryCount + 1);
      }
      logger.error(`[Job Given Up] ID: ${jobId} failed after ${retryCount + 1} attempts.`);
    });

    this.limiter.on("error", (e) => {
      logger.error("[Bottleneck System Error]", e);
    });
  }

  public async enqueue(job: TranscriptionJob): Promise<TranscriptionSegment> {
    const { path, generation, duration, transcriptionPrompt } = job;

    return this.limiter.schedule(
      {
        id: path,
        priority: this.getPriorityByDuration(duration),
      },
      async () => {
        const fileName = path.split("/").pop() ?? 'unknown';
        
        using fileStream = this.storage.openReadStream(path, generation, { validation: 'crc32c' });

        return await this.transcribeSvc.transcribeAudio(fileStream.stream, fileName, transcriptionPrompt, fileStream.sizeBytes);
      }
    )
  }

  private getPriorityByDuration(durationSeconds: number): number {
    // 1. 길이를 100으로 나누고 올림 처리 (예: 50초 -> 0.5 -> 1, 120초 -> 1.2 -> 2)
    const priority = Math.ceil(durationSeconds / 100);

    return Math.min(Math.max(priority, 1), 9);
  }
}

