
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "#config/firebase-admin.js";
import type GcsStorageClient from "#utils/gcs-storage.client.js";
import type { TranscriptSession } from "../queue/message/transcription.session.job.js";
import type FFprobeQueue from "../queue/ffprobe.queue.js";
import type TranscribeQueue from "../queue/transcribe.queue.js";
import type TranscribeAudioRepository from "../repository/transcribe-audio.repository.js";
import type TranscriptionContentRepository from "../repository/transcription-content.repository.js";
import type { TranscriptionSegment } from "../types/transcription-segment.js";
import { TranscribeStatus, type segmentFailure } from "../entity/Transcription.job.js";
import type { TranscriptionContentDoc, TranscriptionMetaDoc } from "../entity/Transcription.content.js";

const gzip = promisify(zlib.gzip);

export default class SessionService {
  private readonly AUDIO_CACHE_TTL = 10 * 60 * 1000; // 10분
  constructor(
    private readonly ffprobeQueue: FFprobeQueue,
    private readonly transcribeQueue: TranscribeQueue,
    private readonly jobRepo: TranscribeAudioRepository,
    private readonly contentRepo: TranscriptionContentRepository,
    private readonly storage: GcsStorageClient,
  ) { }

  public async process(input: TranscriptSession): Promise<void> {
    const { userId, sessionId, transcriptionPrompt } = input;
    const failures: segmentFailure[] = [];
    const prefix = `audios/${input.userId}/${input.sessionId}/`;

    try {
      const processing = await this.jobRepo.markJobPending(sessionId, {
        sessionId,
        userId,
        status: TranscribeStatus.PENDING,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      if (processing) return;

      const audios = await this.storage.getFiles(prefix, { maxResults: 100 });

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
            transcriptionPrompt
          });
        })
      );

      const { textSegments, errors } = this.aggregateResults(results);
      failures.push(...errors);

      if (textSegments.length === 0) {
        return this.jobRepo.markJobFail(sessionId, {
          status: TranscribeStatus.FAILED,
          updatedAt: Timestamp.now(),
          error: {
            message: '변환 완료된 데이터가 없습니다.',
            segmentFailures: failures,
          }
        });
      }

      await this.commitSuccess(sessionId, textSegments.join(' '));

      return;
    } catch (e: any) {
      const errorInfo = e instanceof Error
        ? { message: e.message, stack: e.stack }
        : { message: String(e) };

      await this.jobRepo.markJobFail(sessionId, {
        status: TranscribeStatus.FAILED,
        updatedAt: Timestamp.now(),
        error: {
          ...errorInfo,
          segmentFailures: failures,
        }
      });
    }
  }

  private aggregateResults(results: PromiseSettledResult<TranscriptionSegment>[]) {
    const textSegments: string[] = [];
    const errors: segmentFailure[] = [];

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

  private async commitSuccess(sessionId: string, content: string) {
    const batch = adminFirestore.batch();
    const now = Timestamp.now();

    this.jobRepo.markJobDone(batch, sessionId, {
      status: TranscribeStatus.DONE,
      updatedAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + this.AUDIO_CACHE_TTL),
    });

    await this.save(batch, sessionId, content, now);

    await batch.commit();
  }

  private async save(batch: FirebaseFirestore.WriteBatch, jobId: string, content: string, now: Timestamp) {
    const snippet = content.substring(0, 1000);
    const totalLength = content.length;

    const expiresAt = Timestamp.fromMillis(now.toMillis() + this.AUDIO_CACHE_TTL);

    let metaDoc: TranscriptionMetaDoc;
    let contentDoc: TranscriptionContentDoc | null = null;

    if (content.length > 10 * 1024) {
      const compressedContent = await gzip(content);

      contentDoc = {
        data: new Uint8Array(compressedContent),
        expiresAt
      }
      this.contentRepo.saveContent(batch, jobId, contentDoc);

      metaDoc = {
        data: { snippet, totalLength, contentKey: `${jobId}:content` },
        expiresAt
      }
    } else {
      metaDoc = {
        data: { snippet, totalLength, content },
        expiresAt
      }
    }

    this.contentRepo.saveMeta(batch, jobId, metaDoc);
  }

}