import { Timestamp } from "firebase-admin/firestore";

export enum TranscribeStatus {
  PENDING = 'pending',
  DONE = 'done',
  FAILED = 'failed',
}

export interface segmentFailure {
  idx: number;
  reason?: {
    message: string;
    stack?: string;
  }
}

export interface TranscriptionJobDoc {
  sessionId: string;
  userId: string;
  status: TranscribeStatus;
  updatedAt: Timestamp;
  createdAt: Timestamp;
  expiresAt?: Timestamp;

  error?: {
    message: string;
    stack?: string | undefined;
    segmentFailures?: Array<segmentFailure>;
  }
}


