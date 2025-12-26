
import { adminFirestore } from "#config/firebase-admin.js";
import { TranscriptionMetaConverter, TranscriptionResultConverter, type TranscriptionContentDoc, type TranscriptionMetaDoc } from "../entity/Transcription.content.js";

export default class TranscriptionContentRepository {
  private readonly COLLECTION_NAME = 'content-cache' as const;
  private readonly contentCollection = adminFirestore
    .collection(this.COLLECTION_NAME);

  public saveMeta(
    batch: FirebaseFirestore.WriteBatch,
    jobId: string,
    metaPayload: TranscriptionMetaDoc,
  ) {
    const metaRef = this.contentCollection
      .withConverter(TranscriptionMetaConverter)
      .doc(jobId);

    batch.set(metaRef, metaPayload);
  }

  public saveContent(
    batch: FirebaseFirestore.WriteBatch,
    jobId: string,
    contentPayload: TranscriptionContentDoc,
  ) {
    const contentRef = this.contentCollection
      .doc(jobId)
      .collection('cachedContent')
      .withConverter(TranscriptionResultConverter)
      .doc('default');

    batch.set(contentRef, contentPayload);
  }
}