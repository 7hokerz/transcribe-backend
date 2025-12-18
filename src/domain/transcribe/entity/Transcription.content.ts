
import { Timestamp } from "firebase-admin/firestore";

export interface TranscriptionMetaDoc {
  data: {
    snippet: string;
    totalLength: number;
    content?: string;
    contentKey?: string;
  }
  expiresAt: Timestamp;
}

export interface TranscriptionContentDoc {
  data: Uint8Array<ArrayBuffer>;
  expiresAt: Timestamp;
}

