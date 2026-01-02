import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";

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
  id?: string;
  taskName?: string;
  userId: string;
  status: TranscribeStatus;
  updatedAt: Date;
  createdAt: Date;
  expiresAt?: Date | undefined;

  error?: {
    message: string;
    stack?: string | undefined;
  }

  segmentFailures?: Array<SegmentFailure>;
}

export const TranscriptionJobConverter = {
  /** 앱(Date) -> DB(Timestamp) */
  toFirestore(model: TranscriptionJobDoc): DocumentData {
    const { id, ...rest } = model;
    return {
      ...rest,
      updatedAt: Timestamp.fromDate(model.updatedAt),
      createdAt: Timestamp.fromDate(model.createdAt),
      expiresAt: model.expiresAt ? Timestamp.fromDate(model.expiresAt) : undefined,
    }
  },

  /** DB(Timestamp) -> 앱(Date) */
  fromFirestore(snapshot: QueryDocumentSnapshot): TranscriptionJobDoc {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      taskName: data.taskName,
      userId: data.userId,
      status: data.status as TranscribeStatus,
      updatedAt: (data.updatedAt as Timestamp).toDate(),
      createdAt: (data.createdAt as Timestamp).toDate(),
      expiresAt: data.expiresAt ? (data.expiresAt as Timestamp).toDate() : undefined,
      error: data.error,
      segmentFailures: data.segmentFailures,
    }
  }
}

