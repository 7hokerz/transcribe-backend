import { Timestamp } from "firebase-admin/firestore";
import type CloudTasksQueue from "#global/queue/cloud-tasks.queue.js";
import { TranscribeStatus } from "../entity/Transcription.job.js";
import type { StartTranscriptionRequestDto } from "../dto/transcribe.request.dto.js";
import type TranscriptionJobRepository from "../repository/transcription-job.repository.js";

export default class RequestTranscriptionService {
  constructor(
    private readonly jobRepo: TranscriptionJobRepository,
    private readonly sessionQueue: CloudTasksQueue,
  ) { }

  public async requestTranscription(dto: StartTranscriptionRequestDto) {
    // job 문서 생성
    await this.jobRepo.ensureJobExisted(dto.sessionId, {
      userId: dto.userId,
      status: TranscribeStatus.CREATED,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const taskId = `transcribe-${dto.sessionId}`;

    // Cloud Tasks Queue에 등록
    const { taskName } = await this.sessionQueue.enqueue(dto, taskId);

    return { jobId: dto.sessionId, taskName };
  }
}
