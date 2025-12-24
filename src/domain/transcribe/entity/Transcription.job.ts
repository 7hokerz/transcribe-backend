import type { Timestamp, DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";

export enum TranscribeStatus {
  CREATED = 'created',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
}

export interface SegmentFailure {
  idx: number;
  reason?: {
    message: string;
    stack?: string;
  }
}

export interface TranscriptionJobDoc {
  taskName?: string;
  userId: string;
  status: TranscribeStatus;
  updatedAt: Timestamp;
  createdAt: Timestamp;
  expiresAt?: Timestamp;

  error?: {
    message: string;
    stack?: string | undefined;
  }

  segmentFailures?: Array<SegmentFailure>;
}

export const TranscriptionJobConverter = {
  toFirestore(model: TranscriptionJobDoc): DocumentData {
    return {
      taskName: model.taskName,
      userId: model.userId,
      status: model.status,
      updatedAt: model.updatedAt,
      createdAt: model.createdAt,
      expiresAt: model.expiresAt,
      error: model.error,
      segmentFailures: model.segmentFailures,
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): TranscriptionJobDoc {
    const data = snapshot.data();
    return {
      taskName: data.taskName,
      userId: data.userId,
      status: data.status as TranscribeStatus,
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      error: data.error,
      segmentFailures: data.segmentFailures,
    }
  }
}

