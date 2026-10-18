import { describe, expect, it } from 'vitest';
import {
  cleanCode,
  countLines,
  createDeltaFilter,
  looksUsable,
  stripFences,
  summarizeCode,
} from '@/lib/core/parse';

describe('stripFences', () => {
  it('unwraps a fenced block and drops the surrounding prose', () => {
    const raw = ['Sure! Here is the CSS:', '```css', '.pc-stage { display: grid; }', '```', '', 'Let me know if you want changes.'].join('\n');
    expect(stripFences(raw)).toBe('.pc-stage { display: grid; }');
  });

  it('keeps the largest block when the model fences twice', () => {
    const raw = ['```css', '.a { color: red; }', '```', 'and the full file:', '```css', '.pc-stage { --pc-accent: #22d3ee; display: grid; }', '.pc-el-core { animation: pc-key-pulse 1400ms infinite; }', '```'].join('\n');
    const result = stripFences(raw);
    expect(result).toContain('pc-key-pulse');
    expect(result).not.toContain('.a { color: red; }');
  });

  it('handles an unclosed fence (still streaming)', () => {
    expect(stripFences('```python\nprint("hi")')).toBe('print("hi")');
  });

  it('leaves unfenced code alone', () => {
    expect(stripFences('  .pc-stage { color: red; }\n')).toBe('.pc-stage { color: red; }');
  });
});

describe('cleanCode', () => {
  it('drops a leading "here is" line', () => {
    const raw = "Here's the JavaScript:\n(function () { document.querySelector('.pc-stage'); })();";
    const result = cleanCode(raw, 'javascript');
    expect(result.startsWith('(function')).toBe(true);
  });

  it('drops a trailing explanation', () => {
    const raw = '.pc-stage { display: grid; }\nThis implementation uses a 1400ms cycle.';
    expect(cleanCode(raw, 'css')).toBe('.pc-stage { display: grid; }');
  });

  it('never eats a real first line of code', () => {
    const raw = 'function init() {\n  return 1;\n}';
    expect(cleanCode(raw, 'javascript')).toBe(raw);
  });
});

describe('looksUsable', () => {
  it('rejects refusals and stubs', () => {
    expect(looksUsable("I can't help with that.", 'css')).toBe(false);
    expect(looksUsable('too short', 'css')).toBe(false);
  });

  it('accepts plausible files per target', () => {
    expect(looksUsable('.pc-stage { display: grid; }', 'css')).toBe(true);
    expect(looksUsable('<div class="pc-stage"></div>', 'html')).toBe(true);
    expect(looksUsable("document.querySelector('.pc-stage');", 'javascript')).toBe(true);
    expect(looksUsable('export default function App() { return <div />; }', 'react')).toBe(true);
    expect(looksUsable('def build():\n    print("ok")', 'python')).toBe(true);
  });
});

describe('createDeltaFilter', () => {
  it('suppresses fence lines and holds partial lines', () => {
    const filter = createDeltaFilter();
    // The fence line is dropped and the incomplete code line is held back.
    expect(filter('```css\n.pc-stage {')).toBe('');
    expect(filter('display: grid; }\n```')).toBe('.pc-stage {display: grid; }\n');
  });

  it('emits nothing while a line is incomplete', () => {
    const filter = createDeltaFilter();
    expect(filter('.pc-stage')).toBe('');
    expect(filter(' {\n')).toBe('.pc-stage {\n');
  });
});

describe('summarizeCode / countLines', () => {
  it('skips comment lines and truncates', () => {
    const code = '// a comment\n.pc-stage { display: grid; }';
    expect(summarizeCode(code)).toBe('.pc-stage { display: grid; }');
    expect(countLines(code)).toBe(2);
    expect(countLines('')).toBe(0);
  });
});
