
import { adminFirestore } from "#config/firebase-admin.js";
import { Timestamp } from "firebase-admin/firestore";
import { TranscribeStatus, TranscriptionJobConverter, type TranscriptionJobDoc } from "../entity/Transcription.job.js";
import { mapToInfrastructureError } from "#utils/error-mapper.js";

export default class TranscriptionJobRepository {
  private readonly JOB_COLLECTION = 'transcribe-audio' as const;
  private readonly jobCollection = adminFirestore
    .collection(this.JOB_COLLECTION)
    .withConverter(TranscriptionJobConverter);

  // CREATED
  public async ensureJobExisted(jobId: string, jobPayload: TranscriptionJobDoc) {
    const jobRef = this.jobCollection.doc(jobId);

    try {
      await jobRef.create(jobPayload);
    } catch (e: any) {
      if (e?.code === 6 || e?.code === 'ALREADY_EXISTS') {
        console.warn(`[ensureJobExisted] job already exists, treat as success`, { queueName: this.JOB_COLLECTION, jobId });
        return;
      }

      throw mapToInfrastructureError(e);
    }
  }

  // CREATED -> RUNNING
  public async markJobRunningIfAllowed(jobId: string, jobPayload: Partial<TranscriptionJobDoc>) {
    const jobRef = this.jobCollection.doc(jobId);

    try {
      return await adminFirestore.runTransaction(async (t) => {
        const snap = await t.get(jobRef);
        if (!snap.exists) {
          console.warn(`[markJobRunningIfAllowed] job not found, skip running mark`, { queueName: this.JOB_COLLECTION, jobId });
          return false;
        }

        const job = snap.data();
        if (!job) return false;

        if (job.status === TranscribeStatus.DONE || job.status === TranscribeStatus.FAILED) return false;
        if (job.status === TranscribeStatus.RUNNING && job.updatedAt.toMillis() + 5 * 60 * 1000 > Timestamp.now().toMillis()) return false;

        t.update(jobRef, jobPayload);

        return true;
      });
    } catch (e: any) {
      throw mapToInfrastructureError(e);
    }
  }

  // RUNNING -> DONE
  public markJobDone(
    batch: FirebaseFirestore.WriteBatch,
    jobId: string,
    jobPayload: Partial<TranscriptionJobDoc>
  ) {
    const jobRef = this.jobCollection.doc(jobId);

    batch.update(jobRef, jobPayload);
  }

  // RUNNING -> FAIL
  public async markJobFail(jobId: string, jobPayload: Partial<TranscriptionJobDoc>) {
    const jobRef = this.jobCollection.doc(jobId);

    try {
      await jobRef.update(jobPayload);
    } catch (e: any) {
      if (e?.code === 5 || e?.code === 'NOT_FOUND') {
        console.warn(`[markJobFail] job not found, skip fail mark`, { queueName: this.JOB_COLLECTION, jobId });
        return;
      }
      throw mapToInfrastructureError(e);
    }
  }

  public async commitBatch(batch: FirebaseFirestore.WriteBatch) {
    try {
      await batch.commit();
    } catch (e: any) {
      throw mapToInfrastructureError(e);
    }
  }
}
