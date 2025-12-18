import { z } from 'zod';

export const TranscriptionJobSchema = z.object({
  sessionId: z.string()
    .trim()
    .uuid('유효하지 않은 세션 ID 형식입니다.'),

  path: z.string()
    .trim()
    .min(1, "path가 필요합니다."),

  generation: z.string()
    .trim()
    .min(1),

  duration: z.number()
    .positive(),

  transcriptionPrompt: z.string()
    .trim()
    .max(220, 'prompt는 220자 이하여야 합니다.')
    .optional()
});
export type TranscriptionJob = z.infer<typeof TranscriptionJobSchema>;