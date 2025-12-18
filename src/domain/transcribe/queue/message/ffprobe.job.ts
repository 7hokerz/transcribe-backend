import { z } from 'zod';

export const FFprobeJobSchema = z.object({
  sessionId: z.string()
    .uuid()
    .describe('전사 세션 식별자(UUID)'),

  path: z.string()
    .trim()
    .min(1, "path가 필요합니다.")
    .describe('스토리지 객체 경로'),

  generation: z.string()
    .trim()
    .min(1)
    .describe('스토리지 객체 generation(버전 식별자)'),

  index: z.number()
    .int()
    .nonnegative()
    .describe('청크 인덱스'),
});
export type FFprobeJob = z.infer<typeof FFprobeJobSchema>;
