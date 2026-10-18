import { describe, expect, it } from 'vitest';
import {
  BriefSchema,
  buildContract,
  elementClass,
  fallbackBrief,
  keyframeName,
  parseBrief,
  slugify,
} from '@/lib/core/brief';

const VALID = {
  name: 'Neon Pulse',
  summary: 'A core that pulses behind an expanding halo.',
  elements: [{ name: 'Core Dot', description: 'the pulsing circle' }],
  keyframes: [{ name: 'pulse', from: 'transform: scale(1)', to: 'transform: scale(1.3)' }],
  palette: ['#22d3ee', '#0b1020'],
  easing: 'cubic-bezier(.4, 0, .2, 1)',
  durationMs: 1400,
  loop: true,
};

describe('parseBrief', () => {
  it('accepts JSON wrapped in prose and fences', () => {
    const raw = `Here is the spec:\n\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\`\n`;
    const result = parseBrief(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.brief.name).toBe('Neon Pulse');
  });

  it('applies schema defaults', () => {
    const minimal = {
      name: 'X',
      elements: [{ name: 'A' }],
      keyframes: [{ name: 'k', from: 'a', to: 'b' }],
      palette: ['#fff'],
    };
    const parsed = BriefSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.durationMs).toBe(1200);
      expect(parsed.data.loop).toBe(true);
      expect(parsed.data.summary).toBe('');
    }
  });

  it('reports invalid JSON and schema violations', () => {
    expect(parseBrief('no json here').ok).toBe(false);
    expect(parseBrief('{ not json }').ok).toBe(false);
    const missing = parseBrief(JSON.stringify({ name: 'x' }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/elements|keyframes|palette/i);
  });
});

describe('fallbackBrief', () => {
  it('always produces a schema-valid brief', () => {
    const brief = fallbackBrief('make a bouncing ball with easing');
    expect(BriefSchema.safeParse(brief).success).toBe(true);
    expect(brief.name.toLowerCase()).toContain('bouncing');
    expect(brief.notes.join(' ')).toMatch(/fallback/i);
  });
});

describe('slugify + contract', () => {
  it('is deterministic and URL-safe', () => {
    expect(slugify('Neon Pulse · Ring')).toBe('neon-pulse-ring');
    expect(slugify('  9 lives  ')).toBe('x9-lives');
    expect(slugify('***')).toBe('part');
    expect(slugify('Café Éclair')).toBe('cafe-eclair');
    expect(elementClass('Core Dot')).toBe('pc-el-core-dot');
    expect(keyframeName('pulse')).toBe('pc-key-pulse');
  });

  it('builds one contract that names every class, keyframe, colour and timing', () => {
    const brief = BriefSchema.parse(VALID);
    const contract = buildContract(brief);
    expect(contract).toContain('pc-stage');
    expect(contract).toContain('pc-el-core-dot');
    expect(contract).toContain('pc-key-pulse');
    expect(contract).toContain('#22d3ee');
    expect(contract).toContain('1400ms');
    expect(contract).toContain('loops forever');
    // Identical text for every target is the whole point: same input, same output.
    expect(buildContract(brief)).toBe(contract);
  });

  it('marks one-shot animations', () => {
    const brief = BriefSchema.parse({ ...VALID, loop: false });
    expect(buildContract(brief)).toContain('plays once');
  });
});
