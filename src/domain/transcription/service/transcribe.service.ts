import FormData from 'form-data';
import { BadGatewayError, ERROR_CODES } from '#global/exception/errors.js';
import { AudioPool } from '#global/config/openai-pool.config.js';
import { TranscriptionSegmentSchema, type TranscriptionSegment } from '../types/transcription-segment.js';
import type { Readable } from 'stream';

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

  constructor() { }

  public async transcribeAudio(stream: Readable, fileName: string, prompt?: string, sizeBytes?: number): Promise<TranscriptionSegment> {
    try {
      const form = this.createRequestForm(stream, fileName, prompt, sizeBytes);

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
        message: `OpenAI Whisper API returned status ${statusCode} for file ${fileName}`,
        clientMessage: '음성 변환 API 호출에 실패했습니다.',
        code: ERROR_CODES.EXTERNAL.AI_MODEL_FAILED,
        metadata: { statusCode, fileName, body: errorBody }
      });
    } catch (e: any) {
      if (e instanceof BadGatewayError) throw e;

      throw new BadGatewayError({
        message: `Failed to transcribe ${fileName}: ${e.message ?? e}`,
        clientMessage: '음성 변환에 실패했습니다.',
        code: ERROR_CODES.EXTERNAL.AI_MODEL_FAILED,
        metadata: { fileName, error: e.message ?? e }
      });
    }
  }

  /** 요청 폼 데이터 생성 */
  private createRequestForm(stream: Readable, fileName: string, prompt?: string, sizeBytes?: number) {
    const form = new FormData();

    form.append("file", stream, {
      filename: fileName,
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
}
