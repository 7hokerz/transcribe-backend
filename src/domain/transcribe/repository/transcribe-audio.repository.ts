
import { adminFirestore } from "#config/firebase-admin.js";
import type { TranscriptionJobDoc } from "../entity/Transcription.job.js";

export default class TranscribeAudioRepository {
  private readonly JOB_COLLECTION = 'transcribe-audio' as const;

  public async markJobPending(jobId: string, jobPayload: TranscriptionJobDoc): Promise<boolean> {
    const jobRef = adminFirestore.collection(this.JOB_COLLECTION).doc(jobId);

    try {
      await jobRef.create(jobPayload);
      return false;
    } catch (e: any) {
      if (e.code === 6 || e.code === 'ALREADY_EXISTS') {
        console.info(`[markJobPending] job already exists, treat as success`, { queueName: this.JOB_COLLECTION, jobId });
        return true;
      }
      throw e;
    }
  }

  public markJobDone(
    batch: FirebaseFirestore.WriteBatch, 
    jobId: string, 
    jobPayload: Partial<TranscriptionJobDoc>
  ) {
    const jobRef = adminFirestore.collection(this.JOB_COLLECTION).doc(jobId);

    batch.update(jobRef, jobPayload);
  }

  public async markJobFail(jobId: string, jobPayload: Partial<TranscriptionJobDoc>) {
    const jobRef = adminFirestore.collection(this.JOB_COLLECTION).doc(jobId);

    try {
      await jobRef.update(jobPayload);
    } catch (e: any) {
      if (e.code === 5 || e.code === 'NOT_FOUND') {
        console.warn(`[markJobFail] job not found, skip fail mark`, { queueName: this.JOB_COLLECTION, jobId });
        return;
      }
      throw e;
    }
  }
}
