import type { TranscriptSession } from "../queue/message/transcription.session.job.js";
import type FFprobeQueue from "../queue/ffprobe.queue.js";
import type TranscribeQueue from "../queue/transcribe.queue.js";
import type TranscribeAudioRepository from "../repository/transcribe-audio.repository.js";
import type GcsStorageClient from "#utils/gcs-storage.client.js";

export default class SessionService {
  constructor(
    private readonly ffprobeQueue: FFprobeQueue,
    private readonly transcribeQueue: TranscribeQueue,
    private readonly repo: TranscribeAudioRepository,
    private readonly storage: GcsStorageClient,
  ) { }

  public async process(input: TranscriptSession): Promise<void> {
    const { userId, sessionId, transcriptionPrompt } = input;
    const errors: any[] = [];
    const prefix = `audios/${input.userId}/${input.sessionId}/`;

    try {
      const processing = await this.repo.markJobPending('transcribe-audio', sessionId, { userId });
      if (processing) return;

      const audios = await this.storage.getFiles(prefix, { maxResults: 100 });

      const results = await Promise.allSettled(
        audios.map(async (audio, index) => {
          const { duration } = await this.ffprobeQueue.enqueue({
            sessionId,
            path: audio.name,
            generation: audio.generation,
            index,
          });

          return this.transcribeQueue.enqueue({
            sessionId,
            path: audio.name,
            generation: audio.generation,
            duration,
            transcriptionPrompt
          });
        })
      );

      const textSegments: string[] = [];
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          textSegments.push(result.value.text.trim());
        } else {
          errors.push({
            idx,
            reason: result.reason instanceof Error
              ? { message: result.reason.message, stack: result.reason.stack }
              : result.reason
          });
          console.error(result.reason);
        }
      });

      if (textSegments.length === 0) {
        return await this.repo.markJobFail('transcribe-audio', sessionId, errors);
      }

      return await this.repo.markJobDone('transcribe-audio', sessionId, textSegments.join(' '));
    } catch (e: any) {
      const errorInfo = e instanceof Error
        ? { message: e.message, stack: e.stack }
        : { message: String(e) };

      await this.repo.markJobFail(
        'transcribe-audio',
        sessionId,
        { ...errorInfo, ...(errors ? { errors } : {}), }
      );
    }
  }
}