import { z } from 'zod';

export const AudioValidationResultSchema = z.object({
  duration: z.number()
    .positive()
});
export type AudioValidationResult = z.infer<typeof AudioValidationResultSchema>;