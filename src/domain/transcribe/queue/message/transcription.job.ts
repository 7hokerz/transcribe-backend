import { z } from 'zod';

export const TranscriptionJobSchema = z.object({
  sessionId: z.string()
    .uuid()
    .describe('전사 세션 식별자(UUID)'),

  path: z.string()
    .min(1, 'path가 필요합니다.')
    .describe('스토리지 객체 경로'),

  generation: z.string()
    .min(1)
    .describe('스토리지 객체 generation(버전 식별자)'),

  duration: z.number()
    .positive()
    .describe('오디오 길이(초)'),

  transcriptionPrompt: z.string()
    .trim()
    .max(220, 'prompt는 220자 이하여야 합니다.')
    .optional()
    .describe('전사 품질 보정을 위한 선택 프롬프트'),
});
export type TranscriptionJob = z.infer<typeof TranscriptionJobSchema>;