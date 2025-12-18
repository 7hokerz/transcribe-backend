import type { Request, Response } from "express";
import { TranscriptSessionSchema } from "../queue/message/transcription.session.job.js"
import type SessionQueue from "../queue/session.queue.js";

export default class TranscribeAudioController {
    constructor(
        private readonly sessionQueue: SessionQueue
    ) { }

    public async transcribe(req: Request, res: Response): Promise<void> {
        const validInput = TranscriptSessionSchema.parse(req.body);

        this.sessionQueue.enqueue(validInput);

        res.status(202).json({ jobId: validInput.sessionId });
    }
}