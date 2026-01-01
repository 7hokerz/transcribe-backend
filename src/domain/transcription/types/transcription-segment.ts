import { z } from 'zod';

export const TranscriptionSegmentSchema = z.object({
  text: z.string()
    .trim()
    .min(1, '전사 결과가 필요합니다.')
    .describe('전사 결과 텍스트'),
});
export type TranscriptionSegment = z.infer<typeof TranscriptionSegmentSchema>;