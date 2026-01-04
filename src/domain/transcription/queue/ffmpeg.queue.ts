import PQueue from "p-queue";
import pRetry from "p-retry";
import type GcsStorageClient from "#global/storage/gcs-storage.client.js";
import type { JobQueue } from "./queue.interface.js";
import type { TranscriptionJob } from "./message/transcription.job.js";
import type { TranscriptionSegment } from "../types/transcription-segment.js";
import type FFmpegSerivce from "../service/ffmpeg.service.js";
import type TranscribeService from "../service/transcribe.service.js";
import type { FFmpegJob } from "./message/ffmpeg.job.js";

export default class FFmpegQueue implements JobQueue<FFmpegJob, TranscriptionSegment> {
  private readonly queue: PQueue;

  constructor(
    private readonly storage: GcsStorageClient,
    private readonly ffmpegSvc: FFmpegSerivce,
    private readonly transcribeSvc: TranscribeService,
  ) {
    this.queue = new PQueue({
      concurrency: 1,
      intervalCap: 1,
      interval: 1_000,
    });
  }

  public async enqueue(job: FFmpegJob): Promise<TranscriptionSegment> {
    const { path, generation, duration, index, transcriptionPrompt } = job;

    return await this.queue.add(() =>
      pRetry(async () => {
        const fileName = 'audio.aac';

        // 스토리지 -> 서버 간 스트림
        using fileStream = this.storage.openReadStream(path, generation, { validation: 'crc32c' });

        // 서버 -> OpenAI API 간 스트림
        using transcodeStream = this.ffmpegSvc.runFFmpeg(fileStream, index);

        const [result] = await Promise.all([
          this.transcribeSvc.transcribeAudio(transcodeStream.stream, fileName, transcriptionPrompt),
          transcodeStream.processPromise
        ]);

        return result;
      }, {
        retries: 1,
        factor: 2,
        minTimeout: 2_000,
        maxTimeout: 10_000,
      }), {
      priority: -duration
    });
  }
}