import { z } from 'zod';

export const StartTranscriptionResponseSchema = z.object({
  jobId: z.uuid()
    .describe('비동기 작업 식별자(현재는 세션 UUID와 동일)'),
})
  .strict()
  .describe('전사 시작 응답 DTO');

export type StartTranscriptionResponseDto = z.infer<typeof StartTranscriptionResponseSchema>;