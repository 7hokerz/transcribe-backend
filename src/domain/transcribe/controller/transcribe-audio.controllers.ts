import type { Request, Response } from "express";
import { StartTranscriptionRequestSchema } from "../dto/transcribe.request.dto.js";
import { TranscriptSessionSchema } from "../queue/message/transcription.session.job.js";
import type SessionService from "../service/session.service.js";
import type RequestTranscriptionService from "../service/request-transcription.service.js";

export default class TranscribeAudioController {
  constructor(
    private readonly reqTranscriptionSvc: RequestTranscriptionService,
    private readonly sessionSvc: SessionService,
  ) { }

  public async requestTranscription(req: Request, res: Response) {
    const validInput = StartTranscriptionRequestSchema.parse(req.body);

    const { jobId, taskName } = await this.reqTranscriptionSvc.requestTranscription(validInput);

    res.status(202).json({ jobId, taskName });
  }

  public async handleTranscriptionTask(req: Request, res: Response) {
    const validInput = TranscriptSessionSchema.parse(req.body);

    await this.sessionSvc.process(validInput);

    res.status(204).send();
  }
}
