import FormData from 'form-data';
import type { Readable } from "stream";
import { Pool } from "undici";
import { bucket } from '#config/firebase-admin.js';
import { BadGatewayError, ERROR_CODES } from '#utils/errors.js';

export const AudioPool = new Pool('https://api.openai.com', {
  connections: 20,
  pipelining: 1,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connectTimeout: 5_000,
  headersTimeout: 90_000,
  bodyTimeout: 90_000,
});

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

  public async transcribeAudio(audioPath: string, generation: string, transcriptionPrompt?: string): Promise<string> {
    let fs: Readable | null = null;
    try {
      const audio = bucket.file(audioPath, { generation });

      fs = audio.createReadStream({ validation: "crc32c" });

      const form = new FormData();
      form.append("file", fs, {
        filename: audioPath.split("/").pop()!,
        knownLength: Number(audio.metadata.size),
      });
      form.append("model", this.MODELS.GPT_4o_mini_transcribe);
      form.append("language", this.LANGUAGES.KO);
      form.append("response_format", "text");
      if (transcriptionPrompt) form.append("prompt", transcriptionPrompt);

      const { body, statusCode } = await AudioPool.request({
        method: "POST",
        path: "/v1/audio/transcriptions",
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      });

      if (statusCode === 200) {
        return await body.text();
      }

      let errorBody;
      try {
        errorBody = await body.json();
      } catch (parseError) {
        errorBody = { message: '서버 응답을 처리할 수 없습니다.' };
      }

      throw new BadGatewayError({
        message: `OpenAI Whisper API returned status ${statusCode} for file ${audioPath.split("/").pop()}`,
        clientMessage: '음성 변환 API 호출에 실패했습니다.',
        code: ERROR_CODES.EXTERNAL.AI_MODEL_FAILED,
        metadata: { statusCode, fileName: audioPath.split("/").pop(), body: errorBody }
      });
    } catch (e: any) {
      if (e && typeof e === 'object' && 'statusCode' in e && 'code' in e) {
        throw e;
      }

      throw new BadGatewayError({
        message: `Failed to transcribe ${audioPath.split("/").pop()}: ${e.message ?? e}`,
        clientMessage: '음성 변환에 실패했습니다.',
        code: ERROR_CODES.EXTERNAL.AI_MODEL_FAILED,
        metadata: { fileName: audioPath.split("/").pop(), error: e.message ?? e }
      });
    } finally {
      // 스트림 정리 (메모리 누수 방지)
      if (fs && !fs.destroyed) fs.destroy();
      fs = null;
    }
  }
}