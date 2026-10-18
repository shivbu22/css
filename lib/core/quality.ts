import type { Quality } from './types';

export interface QualityPreset {
  label: string;
  blurb: string;
  temperature: number;
  maxTokens: number;
  /** Add a critique → fix pass after the first draft. */
  critique: boolean;
  /** Extra instruction appended to every target prompt. */
  guidance: string;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  draft: {
    label: 'Draft',
    blurb: 'One pass per target. Fastest.',
    temperature: 0.2,
    maxTokens: 2048,
    critique: false,
    guidance: '',
  },
  polished: {
    label: 'Polished',
    blurb: 'Draft, then a self-critique pass that fixes what it finds.',
    temperature: 0.25,
    maxTokens: 3072,
    critique: true,
    guidance:
      'This is the polished pass: favour correctness and finish over brevity. Respect prefers-reduced-motion.',
  },
};

export function qualityPreset(quality: Quality | undefined): QualityPreset {
  return QUALITY_PRESETS[quality ?? 'draft'] ?? QUALITY_PRESETS.draft;
}
