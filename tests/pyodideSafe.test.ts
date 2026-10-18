import { describe, expect, it } from 'vitest';
import { analyzePython, importedModules, pyodidePackagesFor } from '@/lib/core/pyodideSafe';

describe('importedModules', () => {
  it('finds plain, aliased, multi and from-imports', () => {
    const code = [
      'import math',
      'import numpy as np, os',
      'from matplotlib.animation import FuncAnimation',
      '    import pygame',
    ].join('\n');
    expect(importedModules(code).sort()).toEqual(
      ['math', 'numpy', 'os', 'matplotlib', 'pygame'].sort(),
    );
  });

  it('ignores mentions inside strings and comments', () => {
    const code = '# import turtle in a comment\nprint("import pygame")';
    expect(importedModules(code)).toEqual([]);
  });
});

describe('pyodidePackagesFor', () => {
  it('maps bundled packages that must be loaded explicitly', () => {
    // importedModules() already reduces 'matplotlib.pyplot' to 'matplotlib'.
    expect(pyodidePackagesFor(importedModules('import numpy as np\nfrom matplotlib import pyplot as plt'))).toEqual([
      'numpy',
      'matplotlib',
    ]);
    expect(pyodidePackagesFor(['PIL'])).toEqual(['pillow']);
  });

  it('ignores stdlib and unknown modules', () => {
    expect(pyodidePackagesFor(['math', 'json', 'my_thing'])).toEqual([]);
  });

  it('requests each package once', () => {
    expect(pyodidePackagesFor(['numpy', 'numpy', 'matplotlib'])).toEqual(['numpy', 'matplotlib']);
  });
});

describe('analyzePython', () => {
  it('passes a stdlib-only script', () => {
    const analysis = analyzePython('import math\nprint(math.pi)');
    expect(analysis.verdict).toBe('safe');
    expect(analysis.allowed).toEqual(['math']);
    expect(analysis.runLocally).toEqual(['python animation.py']);
  });

  it('passes the scientific stack that Pyodide ships', () => {
    const code = 'import numpy as np\nimport matplotlib.pyplot as plt\nfrom matplotlib.animation import FuncAnimation';
    const analysis = analyzePython(code);
    expect(analysis.verdict).toBe('safe');
    expect(analysis.blocked).toEqual([]);
    expect(analysis.runLocally.some((line) => line.includes('pip install matplotlib'))).toBe(true);
  });

  it('blocks desktop and network libraries with a reason and a fix', () => {
    const analysis = analyzePython('import pygame\nimport requests');
    expect(analysis.verdict).toBe('unsupported');
    expect(analysis.blocked).toEqual(['pygame', 'requests']);
    expect(analysis.headline).toMatch(/runs locally/i);
    expect(analysis.detail).toContain('pygame');
    expect(analysis.runLocally.join(' ')).toContain('pip install pygame');
  });

  it('warns rather than blocks on unknown imports', () => {
    const analysis = analyzePython('import my_custom_thing\nprint(1)');
    expect(analysis.verdict).toBe('unverified');
    expect(analysis.unknown).toEqual(['my_custom_thing']);
    expect(analysis.blocked).toEqual([]);
  });

  it('flags turtle scripts as desktop-only', () => {
    const analysis = analyzePython('from turtle import Turtle, Screen\nt = Turtle()');
    expect(analysis.verdict).toBe('unsupported');
    expect(analysis.blocked).toEqual(['turtle']);
  });
});
