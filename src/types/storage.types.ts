import { z } from "zod";
import type { Readable } from "stream";

export const AudioChunkRefSchema = z.object({
  name: z.string()
    .trim()
    .min(1),

  generation: z.string()
    .trim()
    .regex(/^\d+$/)
    .describe('스토리지 객체 generation(버전 식별자)'),
}).strict();
export type AudioChunkRef = z.infer<typeof AudioChunkRefSchema>;

export interface AudioStream {
  stream: Readable;
  sizeBytes: number | undefined
}