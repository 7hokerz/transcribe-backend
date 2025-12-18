import { z } from 'zod';

export const TranscriptionSegmentSchema = z.object({
  text: z.string()
    .trim()
    .min(1, 'text가 필요합니다.')
});
export type TranscriptionSegment = z.infer<typeof TranscriptionSegmentSchema>;