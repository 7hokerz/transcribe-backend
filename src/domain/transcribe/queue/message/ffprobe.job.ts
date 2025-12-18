import { z } from 'zod';

export const FFprobeJobSchema = z.object({
  sessionId: z.string()
    .trim()
    .uuid('유효하지 않은 세션 ID 형식입니다.'),

  path: z.string()
    .trim()
    .min(1, "path가 필요합니다."),

  generation: z.string()
    .trim()
    .min(1),

  index: z.number()
    .int()
    .nonnegative(),
});
export type FFprobeJob = z.infer<typeof FFprobeJobSchema>;
