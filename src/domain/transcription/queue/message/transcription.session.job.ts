import { z } from 'zod';

export const TranscriptSessionSchema = z.object({
  sessionId: z.uuid()
    .describe('전사 세션 식별자(UUID)'),

  userId: z.string()
    .trim()
    .min(1)
    .describe('요청 사용자 식별자'),

  transcriptionPrompt: z.string()
    .trim()
    .max(220, 'prompt는 220자 이하여야 합니다.')
    .optional()
    .describe('전사 품질 보정을 위한 선택 프롬프트'),
});
export type TranscriptSessionJob = z.infer<typeof TranscriptSessionSchema>;