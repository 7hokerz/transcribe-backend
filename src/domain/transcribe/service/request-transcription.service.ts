import { Timestamp } from "firebase-admin/firestore";
import { TranscribeStatus } from "../entity/Transcription.job.js";
import type { StartTranscriptionRequestDto } from "../dto/transcribe.request.dto.js";
import type CloudTasksSessionQueue from "../queue/cloud-tasks.session.queue.js";
import type TranscriptionJobRepository from "../repository/transcription-job.repository.js";

export default class RequestTranscriptionService {
  constructor(
    private readonly jobRepo: TranscriptionJobRepository,
    private readonly sessionQueue: CloudTasksSessionQueue,
  ) { }

  public async requestTranscription(dto: StartTranscriptionRequestDto) {
    // job 문서 생성
    await this.jobRepo.ensureJobExisted(dto.sessionId, {
      userId: dto.userId,
      status: TranscribeStatus.CREATED,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Cloud Tasks Queue에 등록
    const { taskName } = await this.sessionQueue.enqueue(dto);

    return { jobId: dto.sessionId, taskName };
  }
}
