import type { Request, Response } from "express";
import { transcriptSessionSchema } from "#dtos/transcribe.dto.js"
import type SessionQueue from "#queues/session.queue.js";

export default class TranscribeAudioController {
    constructor(
        private readonly sessionQueue: SessionQueue
    ) { }

    public async transcribe(req: Request, res: Response): Promise<void> {
        const validInput = transcriptSessionSchema.parse(req.body);

        await this.sessionQueue.enqueue(validInput);

        res.status(202).json({ jobId: validInput.sessionId });
    }
}