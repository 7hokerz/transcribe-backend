import type { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase-admin/firestore";

export interface TranscriptionMetaDoc {
  id?: string;
  snippet: string;
  totalLength: number;
  expiresAt: Timestamp;
}

export interface TranscriptionContentDoc {
  id?: string;
  data: Uint8Array<ArrayBuffer> | string;
  expiresAt: Timestamp;
}

export const TranscriptionResultConverter = {
  toFirestore(model: TranscriptionContentDoc): DocumentData {
    const { id, ...rest } = model;
    return rest;
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): TranscriptionContentDoc {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      data: data.data,
      expiresAt: data.expiresAt,
    }
  }
}

export const TranscriptionMetaConverter = {
  toFirestore(model: TranscriptionMetaDoc): DocumentData {
    const { id, ...rest } = model;
    return rest;
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): TranscriptionMetaDoc {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      snippet: data.snippet,
      totalLength: data.totalLength,
      expiresAt: data.expiresAt,
    }
  }
}


