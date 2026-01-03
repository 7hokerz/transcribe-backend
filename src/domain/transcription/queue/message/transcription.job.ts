export interface TranscriptionJob {
  /** 전사 세션 식별자(UUID) */
  sessionId: string;

  /** 스토리지 객체 경로 */
  path: string;

  /** 스토리지 객체 generation(버전 식별자) */
  generation: string;

  /** 오디오 길이(초) */
  duration: number;

  index: number;

  /** 전사 품질 보정을 위한 선택 프롬프트 */
  transcriptionPrompt?: string;

}