import { spawn } from "child_process";
import { BadRequestError, ERROR_CODES } from "#global/exception/errors.js";
import type GcsStorageClient from "#storage/GcsManager.js";
import type { DisposableStream } from "#storage/storage.types.js";
import type { AudioValidationResult } from "../types/audio-validation-result.js";

type FfprobeMetadata = {
  streams?: Array<{
    codec_type?: string;     // 'audio' 기대
    codec_name?: string;     // aac|mp3|opus 기대
    duration?: string;
    sample_rate?: string;
    channels?: string;
    channel_layout?: string;
  }>;
  format?: {
    format_name?: string;    // "mov,mp4,m4a,..." 같이 콤마 포함 가능
    duration?: string;
  };
};

type NormalizedAudioInfo = {
  codec: string;
  formatName: string;
  durationSec: number;
  sampleRateHz?: number;
  channels?: number;
  channelLayout?: string;
};

export default class FFprobeService {
  private readonly ALLOWED_CODECS = ['aac', 'mp3', 'opus'] as const;
  private readonly ALLOWED_FORMATS = ['m4a', 'mp4', 'mov', 'mp3', 'ogg'] as const;
  private readonly MAX_DURATION = 15 * 60 + 1;
  private readonly MAX_EXECUTION_FFPROBE = 30_000;

  constructor(private readonly storage: GcsStorageClient) { }

  public async validateAudioFile(path: string, idx: number, generation: string): Promise<AudioValidationResult> {
    try {
      using audioStream = this.storage.openReadStream(path, generation, { validation: false });

      const meta = await this.runFFprobe(audioStream, idx);

      const info = this.extractAudioInfo(meta, idx, path);

      this.validateAudioPolicy(info, idx, path);

      if (process.env.NODE_ENV === "development") {
        console.log(`청크 ${idx} 검증 완료:`, { ...info, fileName: path.split('/').pop() });
      }
      return { duration: Math.round(info.durationSec) };
    } catch (e: any) {
      if (e instanceof BadRequestError) throw e;

      const errMsg = e?.message ?? String(e);
      const fileName = path.split('/').pop();

      throw new BadRequestError({
        message: `ffprobe validation failed for chunk ${idx} (${fileName}): ${errMsg}`,
        clientMessage: '오디오 파일 검증에 실패했습니다.',
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, fileName, error: errMsg }
      });
    }
  }

  // ffprobe 실행 + stdout 수집 + JSON 파싱
  private async runFFprobe(audioStream: DisposableStream, idx: number): Promise<FfprobeMetadata> {
    const { stream } = audioStream;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let stdoutData = '';
      let stderrData = '';

      const safeResolve = (value: FfprobeMetadata) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve(value);
      };

      const safeReject = (e: Error) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(e);
      };

      // 스트림 에러 핸들링
      const onStreamError = (e: Error) => {
        console.error("[ffprobe] Stream error", {
          idx,
          error: e.message,
          timestamp: new Date().toISOString(),
        });
        killProcess();
        safeReject(new Error(`Stream read error: ${e.message}`));
      };

      // stdin 에러 핸들링
      const onStdinError = (e: Error) => {
        // ffprobe가 먼저 죽으면 EPIPE가 날 수 있음: 노이즈라 무시
        if (e.message.includes('EPIPE')) return;
        console.error('[ffprobe] stdin error', {
          idx,
          error: e.message,
          timestamp: new Date().toISOString()
        });
        killProcess();
        safeReject(new Error(`FFprobe stdin error: ${e.message}`));
      };

      // ffprobe 프로세스 종료 핸들러
      const onClose = (code: number | null) => {
        if (isSettled) return;
        if (code !== 0) {
          safeReject(new Error(
            `ffprobe exited with code ${code}. stderr: ${stderrData.slice(0, 500)}`
          ));
          return;
        }

        try {
          const meta = JSON.parse(stdoutData) as FfprobeMetadata;
          safeResolve(meta);
        } catch (e) {
          safeReject(new Error(
            `Failed to parse ffprobe JSON output: ${e instanceof Error ? e.message : 'Unknown error'}`
          ));
        }
      }

      // ffprobe 프로세스 시작 실패 핸들러
      const onProcessError = (e: Error) => {
        console.error('[ffprobe] Process spawn error', {
          idx,
          error: e.message,
          timestamp: new Date().toISOString()
        });
        safeReject(new Error(`Failed to start ffprobe: ${e.message}`));
      }

      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-print_format', 'json=c=1',
        '-show_entries', 'stream=codec_type,codec_name,duration,sample_rate,channels,channel_layout',
        '-show_entries', 'format=format_name,duration',
        '-select_streams', 'a:0',
        '-i', 'pipe:0' // 명시적으로 stdin 사용
      ]);

      // ffprobe 프로세스 강제 종료
      const killProcess = () => {
        if (ffprobe.killed) return;
        ffprobe.kill('SIGKILL');
      };

      // 리소스 정리 함수
      const cleanup = () => {
        clearTimeout(timer);

        // stream <-> ffprobe 연결 해제
        stream.unpipe(ffprobe.stdin);
        stream.off('error', onStreamError);

        // ffprobe 리스너 정리
        ffprobe.stdin.off('error', onStdinError);
        ffprobe.stdout.removeAllListeners();
        ffprobe.stderr.removeAllListeners();
        ffprobe.removeAllListeners();
      };

      // 타임아웃 설정
      const timer = setTimeout(() => {
        if (!isSettled) {
          console.error('[ffprobe] Timeout occurred', {
            idx,
            timeout: this.MAX_EXECUTION_FFPROBE,
            timestamp: new Date().toISOString()
          });

          killProcess();
          safeReject(new Error(`ffprobe process timeout after ${this.MAX_EXECUTION_FFPROBE}ms`));
        }
      }, this.MAX_EXECUTION_FFPROBE);

      stream.on('error', onStreamError);
      ffprobe.stdin.on('error', onStdinError);
      ffprobe.stdout.on('data', (data) => { stdoutData += data.toString(); });
      ffprobe.stderr.on('data', (data) => { stderrData += data.toString(); });
      ffprobe.on('close', onClose);
      ffprobe.on('error', onProcessError);

      stream.pipe(ffprobe.stdin);
    });
  }

  // 메타데이터에서 필요한 값만 뽑아 정규화
  private extractAudioInfo(meta: FfprobeMetadata, idx: number, path: string): NormalizedAudioInfo {
    const audioStream = meta.streams?.find((s) => s.codec_type === 'audio');
    if (!audioStream) {
      throw new BadRequestError({
        message: `No valid audio stream found in chunk ${idx}`,
        clientMessage: '유효한 오디오 스트림을 찾을 수 없습니다.',
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, fileName: path.split('/').pop() }
      });
    }

    const codec = audioStream.codec_name;
    if (!codec) {
      throw new BadRequestError({
        message: `Missing codec_name in chunk ${idx}`,
        clientMessage: "오디오 코덱 정보를 확인할 수 없습니다.",
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, fileName: path.split('/').pop() }
      });
    }

    const formatName = meta.format?.format_name?.toLowerCase();
    if (!formatName) {
      throw new BadRequestError({
        message: `Missing format_name in chunk ${idx}`,
        clientMessage: "파일 포맷 정보를 확인할 수 없습니다.",
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, fileName: path.split('/').pop() }
      });
    }

    const rawDuration = audioStream.duration ?? meta.format?.duration;
    const durationSec = rawDuration ? Number.parseFloat(rawDuration) : NaN;
    if (!Number.isFinite(durationSec)) {
      throw new BadRequestError({
        message: `Missing/invalid duration: '${rawDuration}'`,
        clientMessage: "오디오 길이를 확인할 수 없습니다.",
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, rawDuration, fileName: path.split('/').pop() },
      });
    }

    const sampleRateHz = audioStream.sample_rate ? Number.parseInt(audioStream.sample_rate, 10) : undefined;
    const channels = audioStream.channels ? Number.parseInt(audioStream.channels, 10) : undefined;

    return {
      codec,
      formatName,
      durationSec,
      ...(Number.isFinite(sampleRateHz ?? NaN) ? { sampleRateHz: sampleRateHz! } : {}),
      ...(Number.isFinite(channels ?? NaN) ? { channels: channels! } : {}),
      ...(audioStream.channel_layout ? { channelLayout: audioStream.channel_layout } : {}),
    };
  }

  // 허용코덱/포맷/길이 검증
  private validateAudioPolicy(info: NormalizedAudioInfo, idx: number, path: string): void {
    // 코덱 검증 (aac, mp3, opus 지원)
    if (!this.ALLOWED_CODECS.some(allowed => info.codec.includes(allowed))) {
      throw new BadRequestError({
        message: `Invalid audio codec in chunk ${idx}: '${info.codec}' (allowed: ${this.ALLOWED_CODECS.join(', ')})`,
        clientMessage: `허용되지 않는 오디오 코덱입니다: '${info.codec}'`,
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, codec: info.codec, allowedCodecs: this.ALLOWED_CODECS, fileName: path.split('/').pop() }
      });
    }

    // 포맷 검증 (m4a, mp3, opus 지원)
    if (!this.ALLOWED_FORMATS.some(allowed => info.formatName.includes(allowed))) {
      throw new BadRequestError({
        message: `Invalid file format in chunk ${idx}: '${info.formatName}' (allowed: ${this.ALLOWED_FORMATS.join(', ')})`,
        clientMessage: `허용되지 않는 파일 포맷입니다: '${info.formatName}'`,
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, format: info.formatName, allowedFormats: this.ALLOWED_FORMATS, fileName: path.split('/').pop() }
      });
    }

    if (info.durationSec > this.MAX_DURATION) {
      throw new BadRequestError({
        message: `Audio file duration exceeds limit in chunk ${idx}: ${Math.round(info.durationSec)}s`,
        clientMessage: `파일 길이가 너무 깁니다 (${Math.round(info.durationSec)}초)`,
        code: ERROR_CODES.VALIDATION.INVALID_INPUT,
        metadata: { idx, duration: Math.round(info.durationSec), maxDuration: this.MAX_DURATION, fileName: path.split('/').pop() }
      });
    }
  }
}