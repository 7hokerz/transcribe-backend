import { z } from 'zod';

export const TranscriptSessionSchema = z.object({
  sessionId: z.string()
    .trim()
    .uuid('유효하지 않은 세션 ID 형식입니다.'),

  userId: z.string()
    .trim()
    .min(1, "userId가 필요합니다."),

  transcriptionPrompt: z.string()
    .trim()
    .max(220, 'prompt는 220자 이하여야 합니다.')
    .optional()
});
export type TranscriptSession = z.infer<typeof TranscriptSessionSchema>;