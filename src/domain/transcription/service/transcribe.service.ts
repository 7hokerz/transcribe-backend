import FormData from 'form-data';
import { BadGatewayError, ERROR_CODES } from '#global/exception/errors.js';
import { AudioPool } from '#global/config/openai-pool.config.js';
import type GcsStorageClient from '#global/storage/gcs-storage.client.js';
import type { DisposableStream } from '#global/storage/storage.types.js';
import { TranscriptionSegmentSchema, type TranscriptionSegment } from '../types/transcription-segment.js';

export default class TranscribeService {
  private readonly MODELS = {
    GPT_4o_mini_transcribe: "gpt-4o-mini-transcribe",
    GPT_4o_transcribe: "gpt-4o-transcribe",
    Whisper_1: "whisper-1",
  } as const;
  private readonly LANGUAGES = {
    KO: "ko",
    EN: "en",
  } as const;

  constructor(private readonly storage: GcsStorageClient) { }

  public async transcribeAudio(path: string, generation: string, prompt?: string): Promise<TranscriptionSegment> {
    try {
      using audioStream = this.storage.openReadStream(path, generation, { validation: "crc32c" });

      const form = this.createRequestForm(audioStream, path, prompt);

      const { body, statusCode } = await this.sendRequest(form);

      if (statusCode === 200) {
        const rawText = await body.text();

        const validated = TranscriptionSegmentSchema.parse({ text: rawText });
        return validated;
      }

      let errorBody;
      try {
        errorBody = await body.json();
      } catch (parseError) {
        errorBody = { message: '서버 응답을 처리할 수 없습니다.' };
      }

      throw new BadGatewayError({
        message: `OpenAI Whisper API returned status ${statusCode} for file ${this.extractFileName(path)}`,
        clientMessage: '음성 변환 API 호출에 실패했습니다.',
        code: ERROR_CODES.EXTERNAL.AI_MODEL_FAILED,
        metadata: { statusCode, fileName: this.extractFileName(path), body: errorBody }
      });
    } catch (e: any) {
      if (e instanceof BadGatewayError) throw e;

      throw new BadGatewayError({
        message: `Failed to transcribe ${this.extractFileName(path)}: ${e.message ?? e}`,
        clientMessage: '음성 변환에 실패했습니다.',
        code: ERROR_CODES.EXTERNAL.AI_MODEL_FAILED,
        metadata: { fileName: this.extractFileName(path), error: e.message ?? e }
      });
    }
  }

  /** 요청 폼 데이터 생성 */
  private createRequestForm(audioStream: DisposableStream, path: string, prompt?: string) {
    const { stream, sizeBytes } = audioStream;

    const form = new FormData();

    form.append("file", stream, {
      filename: this.extractFileName(path),
      ...(Number.isFinite(sizeBytes ?? NaN) ? { knownLength: sizeBytes! } : {}),
    });
    form.append("model", this.MODELS.GPT_4o_mini_transcribe);
    form.append("language", this.LANGUAGES.KO);
    form.append("response_format", "text");
    if (prompt) form.append("prompt", prompt);

    return form;
  }

  private async sendRequest(form: FormData) {
    return AudioPool.request({
      method: "POST",
      path: "/v1/audio/transcriptions",
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    });
  }

  private extractFileName(path: string) {
    return path.split("/").pop() ?? 'unknown';
  }

}
