import { describe, expect, it } from 'vitest';
import { joinTokens, tokenize, tokenizeLines, type Lang } from '@/lib/core/highlight';

const SAMPLES: Array<{ lang: Lang; code: string }> = [
  {
    lang: 'css',
    code: `.pc-stage {
  --pc-accent: #22d3ee;
  display: grid;
  animation: pc-key-pulse 1400ms cubic-bezier(.4, 0, .2, 1) infinite;
}

@keyframes pc-key-pulse {
  from { transform: scale(.9); opacity: .85; }
  to { transform: scale(1.05); }
}
`,
  },
  {
    lang: 'html',
    code: `<!DOCTYPE html>
<!-- a comment -->
<div class="pc-stage" role="img" aria-label="Pulsing neon loader">
  <p>Loading &amp; waiting</p>
  <style>.a { color: red; }</style>
</div>
`,
  },
  {
    lang: 'javascript',
    code: `// pulse
const stage = document.querySelector('.pc-stage');
if (!stage) return;
const ring = halo.animate(
  [{ transform: 'scale(.7)' }, { transform: 'scale(1.6)' }],
  { duration: 1400, iterations: Infinity },
);
document.addEventListener('visibilitychange', () => ring.pause());
`,
  },
  {
    lang: 'jsx',
    code: `import { useEffect, useRef } from 'react';

export default function Pulse() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 1400 });
  }, []);
  return (
    <div className="pc-stage" data-on={String(true)}>
      <p className="pc-el-label">Loading</p>
    </div>
  );
}
`,
  },
  {
    lang: 'python',
    code: `"""Neon pulse loader."""

import math
from matplotlib.animation import FuncAnimation

ACCENT = "#22d3ee"


@staticmethod
def build(frame: int) -> float:
    beat = (math.sin(frame / 48 * 2 * math.pi) + 1) / 2
    print(f"beat={beat:.2f}")  # debug
    return beat


if __name__ == "__main__":
    build(0)
`,
  },
];

describe('highlighter never loses text', () => {
  it.each(SAMPLES)('round-trips $lang exactly', ({ lang, code }) => {
    expect(joinTokens(tokenize(code, lang))).toBe(code);
  });

  it('round-trips generated-looking edge cases', () => {
    const edge = 'a < b && c > d; x = </span>; trailing "unclosed\nnext line';
    expect(joinTokens(tokenize(edge, 'javascript'))).toBe(edge);
    expect(joinTokens(tokenize(edge, 'jsx'))).toBe(edge);
    expect(joinTokens(tokenize('const x = `tpl ${a} end', 'jsx'))).toBe('const x = `tpl ${a} end');
    expect(joinTokens(tokenize('', 'css'))).toBe('');
    expect(joinTokens(tokenize('@', 'css'))).toBe('@');
    expect(joinTokens(tokenize('<', 'html'))).toBe('<');
    expect(joinTokens(tokenize('a /* unterminated', 'css'))).toBe('a /* unterminated');
  });

  it('never classifies whitespace as punctuation', () => {
    for (const { lang, code } of SAMPLES) {
      const offenders = tokenize(code, lang).filter(
        (token) => token.kind === 'punctuation' && /^\s+$/.test(token.text),
      );
      expect(offenders, `${lang} whitespace`).toEqual([]);
    }
  });

  it('falls back to plain for an unknown language', () => {
    const tokens = tokenize('SOMETHING ELSE', 'brainfuck');
    expect(tokens).toEqual([{ text: 'SOMETHING ELSE', kind: 'plain' }]);
  });
});

describe('classification', () => {
  const kindsOf = (code: string, lang: Lang) => tokenize(code, lang).map((token) => token.kind);

  it('recognises CSS selectors, properties and at-rules', () => {
    const tokens = tokenize(SAMPLES[0].code, 'css');
    const byText = (text: string) => tokens.find((token) => token.text === text)?.kind;
    expect(byText('.pc-stage')).toBe('selector');
    expect(byText('display')).toBe('property');
    expect(byText('--pc-accent')).toBe('property');
    expect(byText('@keyframes')).toBe('keyword');
    expect(byText('cubic-bezier')).toBe('function');
    expect(byText('#22d3ee')).toBe('number');
  });

  it('still finds selectors nested inside at-rule wrappers', () => {
    const code = '@media (prefers-reduced-motion: reduce) {\n  .pc-el-core { animation-duration: 4200ms; }\n}';
    const tokens = tokenize(code, 'css');
    const kinds = tokens.map((token) => `${token.kind}:${token.text.trim()}`);
    expect(kinds).toContain('property:animation-duration');
    expect(tokens.some((token) => token.kind === 'selector' && token.text.includes('.pc-el-core'))).toBe(
      true,
    );
    expect(joinTokens(tokens)).toBe(code);
  });

  it('recognises HTML tags, attributes and comments', () => {
    const tokens = tokenize(SAMPLES[1].code, 'html');
    const byText = (text: string) => tokens.find((token) => token.text === text)?.kind;
    expect(byText('div')).toBe('tag');
    expect(byText('class')).toBe('attr');
    expect(byText('"pc-stage"')).toBe('string');
    expect(byText('<!-- a comment -->')).toBe('comment');
    expect(byText('<!DOCTYPE html>')).toBe('comment');
    expect(kindsOf('&amp;', 'html')).toContain('number');
  });

  it('recognises JS keywords, calls and builtins', () => {
    const tokens = tokenize(SAMPLES[2].code, 'javascript');
    const byText = (text: string) => tokens.find((token) => token.text === text)?.kind;
    expect(byText('const')).toBe('keyword');
    expect(byText('animate')).toBe('function');
    expect(byText('document')).toBe('function');
    expect(byText("'.pc-stage'")).toBe('string');
    expect(byText('1400')).toBe('number');
    expect(byText('// pulse')).toBe('comment');
  });

  it('recognises JSX elements without mistaking comparisons for tags', () => {
    const jsxTokens = tokenize(SAMPLES[3].code, 'jsx');
    const jsxByText = (text: string) => jsxTokens.find((token) => token.text === text)?.kind;
    expect(jsxByText('div')).toBe('tag');
    expect(jsxByText('p')).toBe('tag');
    expect(jsxByText('className')).toBe('attr');
    expect(jsxByText('"pc-stage"')).toBe('string');

    const comparison = tokenize('const small = a < b;', 'jsx');
    expect(comparison.some((token) => token.kind === 'tag')).toBe(false);
  });

  it('recognises Python keywords, builtins, decorators and docstrings', () => {
    const tokens = tokenize(SAMPLES[4].code, 'python');
    const byText = (text: string) => tokens.find((token) => token.text === text)?.kind;
    expect(byText('import')).toBe('keyword');
    expect(byText('def')).toBe('keyword');
    expect(byText('build')).toBe('function');
    expect(byText('print')).toBe('function');
    expect(byText('@staticmethod')).toBe('tag');
    expect(byText('"""Neon pulse loader."""')).toBe('string');
    expect(byText('"#22d3ee"')).toBe('string');
    expect(byText('# debug')).toBe('comment');
  });
});

describe('tokenizeLines', () => {
  it('splits multi-line tokens across lines and preserves the text', () => {
    const code = '/* one\ntwo */\n.x { color: red; }';
    const lines = tokenizeLines(code, 'css');
    expect(lines).toHaveLength(3);
    expect(lines[0].map((token) => token.text).join('')).toBe('/* one');
    expect(lines[1].map((token) => token.text).join('')).toBe('two */');
    const rebuilt = lines
      .map((line) => line.map((token) => token.text).join(''))
      .join('\n');
    expect(rebuilt).toBe(code);
  });

  it('keeps blank lines', () => {
    const lines = tokenizeLines('a\n\nb', 'javascript');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
  });
});
