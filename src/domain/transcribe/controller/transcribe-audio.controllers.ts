import type { Request, Response } from "express";
import type SessionQueue from "../queue/session.queue.js";
import { StartTranscriptionRequestSchema } from "../dto/transcribe.request.dto.js";

export default class TranscribeAudioController {
  constructor(
    private readonly sessionQueue: SessionQueue
  ) { }

  public async transcribe(req: Request, res: Response): Promise<void> {
    const validInput = StartTranscriptionRequestSchema.parse(req.body);

    this.sessionQueue.enqueue(validInput);

    res.status(202).json({ jobId: validInput.sessionId });
  }
}