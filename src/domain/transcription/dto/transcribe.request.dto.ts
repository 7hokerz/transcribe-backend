import { z } from 'zod';

export const StartTranscriptionRequestSchema = z.object({
  sessionId: z.uuid()
    .describe('전사 세션 식별자(UUID)'),

  userId: z.string()
    .min(1)
    .describe('요청 사용자 식별자'),

  transcriptionPrompt: z.string()
    .max(220)
    .optional()
    .describe('전사 품질 보정을 위한 선택 프롬프트'),
})
  .strict()
  .describe('전사 시작 요청 DTO');

export type StartTranscriptionRequestDto = z.infer<typeof StartTranscriptionRequestSchema>;
