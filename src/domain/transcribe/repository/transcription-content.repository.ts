
import { adminFirestore } from "#config/firebase-admin.js";
import type { TranscriptionContentDoc, TranscriptionMetaDoc } from "../entity/Transcription.content.js";

export default class TranscriptionContentRepository {
  private readonly COLLECTION_NAME = 'content-cache' as const;

  public saveContent(
    batch: FirebaseFirestore.WriteBatch,
    jobId: string,
    contentPayload: TranscriptionContentDoc,
  ) {
    const contentRef = adminFirestore.collection(this.COLLECTION_NAME).doc(`${jobId}:content`);

    batch.set(contentRef, contentPayload);
  }

  public saveMeta(
    batch: FirebaseFirestore.WriteBatch,
    jobId: string,
    metaPayload: TranscriptionMetaDoc,
  ) {
    const metaRef = adminFirestore.collection(this.COLLECTION_NAME).doc(`${jobId}:meta`);

    batch.set(metaRef, metaPayload);
  }
}