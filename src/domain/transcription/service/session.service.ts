
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "#global/config/firebase.config.js";
import type GcsStorageClient from "#global/storage/gcs-storage.client.js";
import type { FileReference } from '#global/storage/storage.types.js';
import { AppError } from '#global/exception/errors.js';
import type { TranscriptSessionJob } from "../queue/message/transcription.session.job.js";
import type FFprobeQueue from "../queue/ffprobe.queue.js";
import type TranscribeQueue from "../queue/transcribe.queue.js";
import type TranscriptionJobRepository from "../repository/transcription-job.repository.js";
import type TranscriptionContentRepository from "../repository/transcription-content.repository.js";
import type { TranscriptionSegment } from "../types/transcription-segment.js";
import { TranscribeStatus, type SegmentFailure } from "../entity/Transcription.job.js";

const gzip = promisify(zlib.gzip);

export default class SessionService {
  private readonly AUDIO_CACHE_TTL = 10 * 60 * 1000; // 10분
  constructor(
    private readonly ffprobeQueue: FFprobeQueue,
    private readonly transcribeQueue: TranscribeQueue,
    private readonly jobRepo: TranscriptionJobRepository,
    private readonly contentRepo: TranscriptionContentRepository,
    private readonly storage: GcsStorageClient,
  ) { }

  public async process(input: TranscriptSessionJob) {
    const failures: SegmentFailure[] = [];
    const { userId, sessionId, transcriptionPrompt } = input;
    const prefix = `audios/${userId}/${sessionId}/`;

    try {
      // CREATED -> RUNNING
      const isValid = await this.ensureRunning(sessionId);
      if (!isValid) return;

      const audios = await this.storage.getFiles(prefix, { maxResults: 100 });

      const { textSegments, errors } = await this.runTranscription(audios, sessionId, transcriptionPrompt);

      failures.push(...errors);

      // RUNNING -> FAIL
      if (textSegments.length === 0) {
        return await this.jobRepo.markJobFail(sessionId, {
          status: TranscribeStatus.FAILED,
          updatedAt: Timestamp.now(),
          error: { message: '변환 완료된 데이터가 없습니다.' },
          segmentFailures: failures,
        });
      }

      // RUNNING -> DONE
      return await this.commitSuccess(sessionId, textSegments.join(' '), failures);
    } catch (e: any) {
      // Retryable Error -> Cloud Tasks 재시도
      if (e instanceof AppError && [502, 503, 504].includes(e.statusCode)) {
        throw e;
      }

      const errorInfo = e instanceof Error
        ? { message: e.message, stack: e.stack }
        : { message: String(e) };

      // RUNNING -> FAIL
      await this.jobRepo.markJobFail(sessionId, {
        status: TranscribeStatus.FAILED,
        updatedAt: Timestamp.now(),
        error: errorInfo,
        segmentFailures: failures,
      }).catch(dbErr => console.error("Failed to mark job fail:", dbErr));

      return;
    }
  }

  /** CREATED -> RUNNING */
  private async ensureRunning(sessionId: string) {
    return this.jobRepo.markJobRunningIfAllowed(sessionId, {
      status: TranscribeStatus.RUNNING,
      updatedAt: Timestamp.now(),
    });
  }

  /** ffprobe 검증 + 전사 작업 */
  private async runTranscription(audios: FileReference[], sessionId: string, transcriptionPrompt?: string) {
    const results = await Promise.allSettled(
      audios.map(async (audio, index) => {
        const { duration } = await this.ffprobeQueue.enqueue({
          sessionId,
          path: audio.name,
          generation: audio.generation,
          index,
        });

        return this.transcribeQueue.enqueue({
          sessionId,
          path: audio.name,
          generation: audio.generation,
          duration,
          ...(transcriptionPrompt && { transcriptionPrompt })
        });
      })
    );

    return this.aggregateResults(results);
  }

  /** 전사 성공/실패 취합 */
  private aggregateResults(results: PromiseSettledResult<TranscriptionSegment>[]) {
    const textSegments: string[] = [];
    const errors: SegmentFailure[] = [];

    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        textSegments.push(r.value.text.trim());
      }
      else {
        errors.push({
          idx,
          reason: r.reason instanceof Error
            ? { message: r.reason.message, stack: r.reason.stack }
            : r.reason
        });
        console.error(r.reason);
      }
    });

    return { textSegments, errors };
  }

  /** RUNNING -> DONE */
  private async commitSuccess(sessionId: string, content: string, failures: SegmentFailure[]) {
    const batch = adminFirestore.batch();
    const now = Timestamp.now();

    this.jobRepo.markJobDone(batch, sessionId, {
      status: TranscribeStatus.DONE,
      updatedAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + this.AUDIO_CACHE_TTL),
      segmentFailures: failures
    });

    await this.save(batch, sessionId, content, now);

    await this.jobRepo.commitBatch(batch);
  }

  /** 결과물 저장 */
  private async save(batch: FirebaseFirestore.WriteBatch, jobId: string, content: string, now: Timestamp) {
    const snippet = content.substring(0, 1000);
    const totalLength = content.length;
    const expiresAt = Timestamp.fromMillis(now.toMillis() + this.AUDIO_CACHE_TTL);

    this.contentRepo.saveMeta(batch, jobId, {
      snippet,
      totalLength,
      expiresAt
    });

    const contentPayload = await this.prepareContentPayload(content, now);

    this.contentRepo.saveContent(batch, jobId, contentPayload);
  }

  /** content 압축 */
  private async prepareContentPayload(content: string, now: Timestamp) {
    const expiresAt = Timestamp.fromMillis(now.toMillis() + this.AUDIO_CACHE_TTL);

    if (content.length > 10 * 1024) {
      const compressed = await gzip(content);
      return { data: new Uint8Array(compressed), expiresAt };
    }

    return { data: content, expiresAt };
  }
}
