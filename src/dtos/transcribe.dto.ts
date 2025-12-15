import { z } from 'zod';

export const transcriptSessionSchema = z.object({
  sessionId: z.string()
    .uuid('유효하지 않은 세션 ID 형식입니다.'),

  userId: z.string()
    .min(1, "userId가 필요합니다."),

  transcriptionPrompt: z.string()
    .trim()
    .max(220, 'prompt는 220자 이하여야 합니다.')
    .optional()
});
export type transcriptSession = z.infer<typeof transcriptSessionSchema>;

export const FFprobeJobSchema = z.object({
  jobId: z.string()
    .uuid('유효하지 않은 세션 ID 형식입니다.'),

  audioPath: z.string()
    .min(1, "audioPath가 필요합니다."),

  generation: z.string(),

  index: z.number(),
});
export type FFprobeJob = z.infer<typeof FFprobeJobSchema>;

export const TranscriptionJobSchema = z.object({
  jobId: z.string()
    .uuid('유효하지 않은 세션 ID 형식입니다.'),

  audioPath: z.string()
    .min(1, "audioPath가 필요합니다."),

  generation: z.string(),

  duration: z.number(),

  transcriptionPrompt: z.string()
    .trim()
    .max(220, 'prompt는 220자 이하여야 합니다.')
    .optional()
});
export type TranscriptionJob = z.infer<typeof TranscriptionJobSchema>;

export enum TranscribeStatus {
  PENDING = 'pending',
  DONE = 'done',
  FAILED = 'failed',
}
