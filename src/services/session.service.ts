import { bucket, type GCSFile } from "#config/firebase-admin.js";
import type { transcriptSession } from "#dtos/transcribe.dto.js";
import type FFprobeQueue from "#queues/ffprobe.queue.js";
import type TranscribeQueue from "#queues/transcribe.queue.js";
import type TranscribeAudioRepository from "#repositories/transcribe-audio.repository.js";

export default class SessionService {
  constructor(
    private readonly ffprobeQueue: FFprobeQueue,
    private readonly transcribeQueue: TranscribeQueue,
    private readonly repo: TranscribeAudioRepository,
  ) { }

  public async process(input: transcriptSession): Promise<void> {
    const { userId, sessionId, transcriptionPrompt } = input;
    const errors: any[] = [];
    const prefix = `audios/${input.userId}/${input.sessionId}/`;

    try {
      const processing = await this.repo.markJobPending('transcribe-audio', sessionId, {
        userId,
      });
      if (processing) return;

      const audios = await this.getFiles(prefix);

      const results = await Promise.allSettled(
        audios.map(async (audio, index) => {
          const audioPath = audio.name;
          const generation = audio.metadata.generation as string;

          const duration = await this.ffprobeQueue.enqueue({
            jobId: sessionId,
            audioPath,
            generation,
            index,
          });

          return await this.transcribeQueue.enqueue({
            jobId: sessionId,
            audioPath,
            generation,
            duration,
            transcriptionPrompt: transcriptionPrompt || ''
          });
        })
      );

      const textSegments: string[] = [];
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          textSegments.push(result.value.trim());
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

  private async getFiles(prefix: string): Promise<GCSFile[]> {
    const [allObjects] = await bucket.getFiles({
      prefix,
      maxResults: 100,
    });
    return allObjects.filter(file => !file.name.endsWith('/')).sort((a, b) => a.name.localeCompare(b.name));
  }
}