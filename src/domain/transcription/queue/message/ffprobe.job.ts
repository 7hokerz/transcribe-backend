export interface FFprobeJob {
  /** 전사 세션 식별자(UUID) */
  sessionId: string;

  /** 스토리지 객체 경로 */
  path: string;

  /** 스토리지 객체 generation(버전 식별자) */
  generation: string;

  /** 청크 인덱스 */
  index: number;
}
