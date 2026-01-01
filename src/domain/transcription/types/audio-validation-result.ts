import { z } from 'zod';

export const AudioValidationResultSchema = z.object({
  duration: z.number()
    .positive()
    .describe('오디오 길이(초)'),
});
export type AudioValidationResult = z.infer<typeof AudioValidationResultSchema>;