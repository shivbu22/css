import { z } from 'zod';
import { BriefSchema } from '@/lib/core/brief';
import { TARGETS, type Target } from '@/lib/core/types';

const TARGET_VALUES = TARGETS as unknown as readonly [Target, ...Target[]];

export const GenerateRequestSchema = z.object({
  mode: z.enum(['fanout', 'target', 'refine']),
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().max(120).optional(),
  quality: z.enum(['draft', 'polished']).optional(),
  brief: BriefSchema.nullish(),
  target: z.enum(TARGET_VALUES).optional(),
  targets: z.array(z.enum(TARGET_VALUES)).max(TARGETS.length).optional(),
  instruction: z.string().max(2000).optional(),
  current: z.string().max(200_000).optional(),
  currentByTarget: z.record(z.enum(TARGET_VALUES), z.string().max(200_000)).optional(),
});

export type GeneratePayload = z.infer<typeof GenerateRequestSchema>;
