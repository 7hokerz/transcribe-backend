import { spawn } from "child_process";
import type { DisposableStream } from "#global/storage/storage.types.js";
import { DisposableTranscodeStream } from "../types/disposable-transcode.js";

export default class FFmpegSerivce {
  private readonly MAX_EXECUTION_FFMPEG = 60_000;

  public runFFmpeg(videoStream: DisposableStream, idx: number) {
    const { stream } = videoStream;

    // 스트림을 즉시 반환해야 하므로 spawn은 밖으로
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',         // 입력 소스: 명시적으로 stdin 사용
      '-vn',                  // video 제외
      '-avoid_negative_ts', 'make_zero',
      '-map', '0:a:0',        // 첫 번째 입력(0)의 첫 번째 오디오(a:0)만 선택
      '-map_metadata', '-1',  // (선택적/정보성) 메타데이터 제거
      '-acodec', 'aac',       // 오디오 코덱: AAC
      '-b:a', '128k',         // 비트레이트
      '-f', 'adts',           // 출력 포맷: ADTS (AAC 스트리밍용)
      'pipe:1',               // stdout
    ]);

    const processPromise = new Promise<void>((resolve, reject) => {
      let isSettled = false;
      let stderrData = '';

      const safeResolve = () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve();
      };

      const safeReject = (e: Error) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(e);
      };

      // 스트림 에러 핸들링
      const onStreamError = (e: Error) => {
        console.error("[ffmpeg] Stream error", {
          idx,
          error: e.message,
          timestamp: new Date().toISOString(),
        });
        killProcess();
        safeReject(new Error(`Stream read error: ${e.message}`));
      };

      // stdin 에러 핸들링
      const onStdinError = (e: Error) => {
        if (e.message.includes('EPIPE')) return;
        console.error('[ffmpeg] stdin error', {
          idx,
          error: e.message,
          timestamp: new Date().toISOString()
        });
        killProcess();
        safeReject(new Error(`FFmpeg stdin error: ${e.message}`));
      };

      // ffmpeg 프로세스 시작 실패 핸들러
      const onProcessError = (e: Error) => {
        console.error('[ffmpeg] Process spawn error', {
          idx,
          error: e.message,
          timestamp: new Date().toISOString()
        });
        safeReject(new Error(`Failed to start ffmpeg: ${e.message}`));
      };

      // ffmpeg 프로세스 종료 핸들러
      const onClose = (code: number | null) => {
        if (isSettled) return;
        if (code === 0) {
          safeResolve();
        } else {
          safeReject(new Error(
            `ffmpeg exited with code ${code}. stderr: ${stderrData.slice(0, 500)}`
          ));
        }
      };

      // ffmpeg 프로세스 강제 종료
      const killProcess = () => {
        if (ffmpeg.killed) return;
        ffmpeg.kill('SIGKILL');
      };

      // 리소스 정리 함수
      const cleanup = () => {
        clearTimeout(timer);

        // stream <-> ffmpeg 연결 해제
        stream.unpipe(ffmpeg.stdin);
        stream.off('error', onStreamError);

        // ffprobe 리스너 정리
        ffmpeg.stdin.off('error', onStdinError);
        ffmpeg.stderr.removeAllListeners();
        ffmpeg.removeAllListeners('close');
        ffmpeg.removeAllListeners('error');
      };

      stream.on('error', onStreamError);
      ffmpeg.stdin.on('error', onStdinError);
      ffmpeg.stderr.on('data', (data) => { stderrData += data.toString() });
      ffmpeg.on('close', onClose);
      ffmpeg.on('error', onProcessError);

      // 타임아웃 설정
      const timer = setTimeout(() => {
        if (!isSettled) {
          console.error('[ffmpeg] Timeout occurred', {
            idx,
            timeout: this.MAX_EXECUTION_FFMPEG,
            timestamp: new Date().toISOString()
          });

          killProcess();
          safeReject(new Error(`FFmpeg execution timeout after ${this.MAX_EXECUTION_FFMPEG}ms`));
        }
      }, this.MAX_EXECUTION_FFMPEG);

      stream.pipe(ffmpeg.stdin);
    });

    return new DisposableTranscodeStream(
      ffmpeg.stdout,
      ffmpeg,
      processPromise
    );
  }
}