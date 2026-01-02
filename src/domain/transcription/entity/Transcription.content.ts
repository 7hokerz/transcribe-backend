import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";

export interface TranscriptionMetaDoc {
  id?: string;
  snippet: string;
  totalLength: number;
  expiresAt: Date;
}

export interface TranscriptionContentDoc {
  id?: string;
  data: string | Uint8Array<ArrayBuffer>;
  expiresAt: Date;
}

export const TranscriptionResultConverter = {
  /** 앱(Date) -> DB(Timestamp) */
  toFirestore(model: TranscriptionContentDoc): DocumentData {
    const { id, ...rest } = model;
    return {
      ...rest,
      expiresAt: Timestamp.fromDate(model.expiresAt),
    }
  },

  /** DB(Timestamp) -> 앱(Date) */
  fromFirestore(snapshot: QueryDocumentSnapshot): TranscriptionContentDoc {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      data: data.data,
      expiresAt: (data.expiresAt as Timestamp).toDate(),
    }
  }
}

export const TranscriptionMetaConverter = {
  /** 앱(Date) -> DB(Timestamp) */
  toFirestore(model: TranscriptionMetaDoc): DocumentData {
    const { id, ...rest } = model;
    return {
      ...rest,
      expiresAt: Timestamp.fromDate(model.expiresAt),
    }
  },

  /** DB(Timestamp) -> 앱(Date) */
  fromFirestore(snapshot: QueryDocumentSnapshot): TranscriptionMetaDoc {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      snippet: data.snippet,
      totalLength: data.totalLength,
      expiresAt: (data.expiresAt as Timestamp).toDate(),
    }
  }
}


