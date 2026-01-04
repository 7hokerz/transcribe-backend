import { spawn } from "child_process";
import { BadRequestError, ERROR_CODES } from "#global/exception/errors.js";
import type GcsStorageClient from "#global/storage/gcs-storage.client.js";
import type { DisposableStream } from "#global/storage/storage.types.js";
import type { AudioValidationResult } from "../types/audio-validation-result.js";

type FfprobeMetadata = {
  streams?: Array<{
    codec_type?: string;     // 'audio'|'video' 기대
    codec_name?: string;
    duration?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    sample_rate?: string;
    channels?: string;
    channel_layout?: string;
  }>;
  format?: {
    format_name?: string;    // "mov,mp4,m4a,..." 같이 콤마 포함 가능
    duration?: string;
  };
};

interface BaseMediaInfo {
  formatName: string;
  durationSec: number;
}

interface AudioTrackInfo {
  codecName: string;
  sampleRateHz?: number;
  channels?: number;
  channelLayout?: string;
}

interface VideoTrackInfo {
  codecName: string;
  width: number;
  height: number;
  fps?: number;
}

interface NormalizedMediaInfo extends BaseMediaInfo {
  audio?: AudioTrackInfo;
  video?: VideoTrackInfo;
}

export default class FFprobeService {
  private readonly ALLOWED_CODECS = ['aac', 'mp3', 'opus'] as const;
  private readonly ALLOWED_FORMATS = ['m4a', 'mp4', 'mov', 'mp3', 'ogg'] as const;
  private readonly MAX_DURATION = 15 * 60 + 1;
  private readonly MAX_EXECUTION_FFPROBE = 30_000;

  constructor(private readonly storage: GcsStorageClient) { }

  public async validateAudioFile(path: string, idx: number, generation: string, contentType: string): Promise<AudioValidationResult> {
    try {
      using fileStream = this.storage.openReadStream(path, generation, { validation: false });

      const selector = contentType.startsWith('video/') ? 'a:0,v:0' : 'a:0';

      const meta = await this.runFFprobe(fileStream, idx, selector);

      const info = this.extractMediaInfo(meta, idx, path);

      this.validateAudioPolicy(info, idx, path);

      if (process.env.NODE_ENV === "development") {
        console.log(`청크 ${idx} 검증 완료:`, { ...info, fileName: path.split('/').pop() });
      }
      return { duration: Math.round(info.durationSec), isVideo: !!info.video };
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

  /** ffprobe 실행 + stdout 수집 + JSON 파싱 */
  private async runFFprobe(fileStream: DisposableStream, idx: number, selector: string): Promise<FfprobeMetadata> {
    const { stream } = fileStream;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let stdoutData = '';
      let stderrData = '';

      const safeResolve = (v: FfprobeMetadata) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve(v);
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

      // ffprobe 프로세스 시작 실패 핸들러
      const onProcessError = (e: Error) => {
        console.error('[ffprobe] Process spawn error', {
          idx,
          error: e.message,
          timestamp: new Date().toISOString()
        });
        safeReject(new Error(`Failed to start ffprobe: ${e.message}`));
      }

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

      const ffprobe = spawn('ffprobe', [
        '-v', 'error',                // 로그: 에러만 출력
        '-print_format', 'json=c=1',  // 출력 포맷: c=1 공백 제거
        '-show_entries',              // 메타데이터
        'stream=codec_type,codec_name,duration,width,height,r_frame_rate,sample_rate,channels,channel_layout:format=format_name,duration',
        '-select_streams', selector,  // 스트림 선택
        '-i', 'pipe:0'                // 입력 소스: 명시적으로 stdin 사용
      ]);

      stream.on('error', onStreamError);
      ffprobe.stdin.on('error', onStdinError);
      ffprobe.stdout.on('data', (data) => { stdoutData += data.toString(); });
      ffprobe.stderr.on('data', (data) => { stderrData += data.toString(); });
      ffprobe.on('close', onClose);
      ffprobe.on('error', onProcessError);

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

      stream.pipe(ffprobe.stdin);
    });
  }

  /** 메타데이터에서 필요한 값만 뽑아 정규화 */
  private extractMediaInfo(meta: FfprobeMetadata, idx: number, path: string): NormalizedMediaInfo {
    const fileName = path.split('/').pop();

    // 포맷(컨테이너) 정보 확인
    const formatName = meta.format?.format_name?.toLowerCase();
    if (!formatName) {
      throw new BadRequestError({
        message: `Missing format_name in chunk ${idx}`,
        clientMessage: "파일 포맷 정보를 확인할 수 없습니다.",
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, fileName }
      });
    }

    // 전체 길이 확인
    const rawDuration = meta.format?.duration ?? meta.streams?.[0]?.duration;
    const durationSec = rawDuration ? parseFloat(rawDuration) : NaN;
    if (!isFinite(durationSec)) {
      throw new BadRequestError({
        message: `Missing/invalid duration: '${rawDuration}'`,
        clientMessage: "오디오 길이를 확인할 수 없습니다.",
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, rawDuration, fileName },
      });
    }

    // 스트림 찾기
    const videoStream = meta.streams?.find(s => s.codec_type === 'video');
    const audioStream = meta.streams?.find(s => s.codec_type === 'audio');
    if (!audioStream) {
      throw new BadRequestError({
        message: `No valid audio stream found in chunk ${idx}`,
        clientMessage: '유효한 오디오 스트림을 찾을 수 없습니다.',
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, fileName }
      });
    }

    const result: NormalizedMediaInfo = {
      formatName,
      durationSec,
    }

    if (videoStream) {
      if (!videoStream.codec_name || !videoStream.width || !videoStream.height) {
        throw new BadRequestError({
          message: `Missing codec_name in chunk ${idx}`,
          clientMessage: "비디오 코덱 정보를 확인할 수 없습니다.",
          code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
          metadata: { idx, fileName }
        });
      }

      result.video = {
        codecName: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
      };
    }

    if (audioStream) {
      if (!audioStream.codec_name) {
        throw new BadRequestError({
          message: `Missing codec_name in chunk ${idx}`,
          clientMessage: "오디오 코덱 정보를 확인할 수 없습니다.",
          code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
          metadata: { idx, fileName }
        });
      }

      const sampleRateHz = audioStream.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined;
      const channels = audioStream.channels ? parseInt(audioStream.channels, 10) : undefined;

      result.audio = {
        codecName: audioStream.codec_name,
        ...(isFinite(sampleRateHz ?? NaN) ? { sampleRateHz: sampleRateHz! } : {}),
        ...(isFinite(channels ?? NaN) ? { channels: channels! } : {}),
        ...(audioStream.channel_layout ? { channelLayout: audioStream.channel_layout } : {}),
      };
    }

    return result;
  }

  /** 허용코덱/포맷/길이 검증 */
  private validateAudioPolicy(info: NormalizedMediaInfo, idx: number, path: string): void {
    // 코덱 검증 (aac, mp3, opus 지원)
    if (!this.ALLOWED_CODECS.some(allowed => info.audio?.codecName.includes(allowed))) {
      throw new BadRequestError({
        message: `Invalid audio codec in chunk ${idx}: '${info.audio?.codecName}' (allowed: ${this.ALLOWED_CODECS.join(', ')})`,
        clientMessage: `허용되지 않는 오디오 코덱입니다: '${info.audio?.codecName}'`,
        code: ERROR_CODES.VALIDATION.INVALID_FORMAT,
        metadata: { idx, codec: info.audio?.codecName, allowedCodecs: this.ALLOWED_CODECS, fileName: path.split('/').pop() }
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