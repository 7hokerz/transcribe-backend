import { adminFirestore } from "#config/firebase-admin.js";
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Timestamp } from "firebase-admin/firestore";
import { TranscribeStatus } from "#dtos/transcribe.dto.js";

const gzip = promisify(zlib.gzip);
const COLLECTION_NAME = 'content-cache';

export default class TranscribeAudioRepository {
  private readonly AUDIO_CACHE_TTL = 10 * 60 * 1000; // 10분

  public async markJobPending(queueName: string, jobId: string, metadata: any): Promise<boolean> {
    const jobRef = adminFirestore.collection(queueName).doc(jobId);

    const now = Timestamp.now();

    try {
      await jobRef.create({
        ...metadata,
        status: "PENDING",
        updatedAt: now,
        createdAt: now,
      });

      return false;
    } catch (e: any) {
      if (e.code === 6 || e.code === 'ALREADY_EXISTS') {
        console.info(`[markJobPending] job already exists, treat as success`, { queueName, jobId });
        return true;
      }
      throw e;
    }
  }

  public async markJobDone(queueName: string, jobId: string, content: string): Promise<void> {
    const contentRef = adminFirestore.collection(COLLECTION_NAME).doc(`${jobId}:content`);
    const metaRef = adminFirestore.collection(COLLECTION_NAME).doc(`${jobId}:meta`);
    const jobRef = adminFirestore.collection(queueName).doc(jobId);

    const snippet = content.substring(0, 1000);
    const totalLength = content.length;
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + this.AUDIO_CACHE_TTL);

    const batch = adminFirestore.batch();

    if (content.length > 10 * 1024) {
      const compressedContent = await gzip(content);

      // content 문서 저장 (Uint8Array로 변환)
      batch.set(contentRef, {
        data: new Uint8Array(compressedContent),
        expiresAt
      });

      batch.set(metaRef, {
        data: {
          snippet,
          totalLength,
          contentKey: `${jobId}:content`
        },
        expiresAt
      });
    } else {
      batch.set(metaRef, {
        data: {
          snippet,
          totalLength,
          content,
        },
        expiresAt
      });
    }

    batch.update(jobRef, {
      status: TranscribeStatus.DONE,
      updatedAt: now,
      expiresAt,
    });

    await batch.commit();
  }

  public async markJobFail(queueName: string, jobId: string, error?: any): Promise<void> {
    const jobRef = adminFirestore.collection(queueName).doc(jobId);
    const now = Timestamp.now();

    const batch = adminFirestore.batch();
    batch.update(jobRef, {
      status: TranscribeStatus.FAILED,
      updatedAt: now,
      ...(error ? { error } : {}),
    });

    try {
      await batch.commit();
    } catch (e: any) {
      if (e.code === 5 || e.code === 'NOT_FOUND') {
        console.warn(`[markJobFail] job not found, skip fail mark`, { queueName, jobId });
        return;
      }

      throw e;
    }
  }
}
