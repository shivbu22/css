/**
 * Can this Python script run in the browser, or does it need a local interpreter?
 *
 * Pyodide covers a large slice of the ecosystem (stdlib, numpy, matplotlib,
 * pandas, scipy), so most generated visualisations preview fine. Anything that
 * needs a desktop toolkit or the network is flagged instead of silently failing:
 * the pane shows the script plus the commands to run it locally.
 *
 * Unknown imports are a warning, not a block — an incomplete allow-list must
 * never stop a legitimate stdlib import from running.
 */

export type PythonVerdict = 'safe' | 'unverified' | 'unsupported';

export interface PythonAnalysis {
  verdict: PythonVerdict;
  /** Modules known to work in Pyodide. */
  allowed: string[];
  /** Imports with no preview — desktop toolkits, network, subprocess. */
  blocked: string[];
  /** Imports that are neither confirmed nor known-bad. */
  unknown: string[];
  headline: string;
  detail: string;
  /** Commands to run the same script locally. */
  runLocally: string[];
}

/** Modules shipped with (or installable in) the browser runtime we use. */
export const PYODIDE_ALLOWED = new Set([
  // stdlib that behaves in Pyodide
  'abc', 'array', 'base64', 'bisect', 'cmath', 'collections', 'contextlib', 'copy', 'csv',
  'dataclasses', 'datetime', 'decimal', 'difflib', 'enum', 'fractions', 'functools', 'graphlib',
  'hashlib', 'heapq', 'html', 'io', 'itertools', 'json', 'math', 'numbers', 'operator',
  'pathlib', 'pickle', 'pprint', 'queue', 'random', 're', 'secrets', 'statistics', 'string',
  'textwrap', 'time', 'traceback', 'types', 'typing', 'unicodedata', 'uuid', 'warnings',
  'weakref', 'zoneinfo', 'os', 'sys', 'builtins', 'asyncio',
  // scientific stack available in Pyodide
  'numpy', 'matplotlib', 'pandas', 'scipy', 'sympy', 'networkx', 'pillow', 'PIL',
  'pyparsing', 'cycler', 'kiwisolver', 'dateutil', 'pytz', 'six', 'packaging', 'decorator',
  'cloudpickle', 'micropip', 'sqlite3', 'lzma', 'zlib', 'gzip', 'tarfile', 'zipfile',
]);

/** Modules that cannot work in the browser, with a reason and a local fix. */
export const PYODIDE_BLOCKED: Record<string, { why: string; fix: string }> = {
  turtle: { why: 'needs a desktop window', fix: 'pip install PythonTurtle  # or just: python animation.py' },
  tkinter: { why: 'needs a desktop window', fix: 'python animation.py  # run with a local Tk install' },
  pygame: { why: 'needs SDL and a desktop window', fix: 'pip install pygame && python animation.py' },
  manim: { why: 'needs ffmpeg and a full rendering pipeline', fix: 'pip install manim && manim -pql animation.py' },
  kivy: { why: 'needs a desktop window', fix: 'pip install kivy && python animation.py' },
  PyQt5: { why: 'needs a desktop window', fix: 'pip install PyQt5 && python animation.py' },
  PySide6: { why: 'needs a desktop window', fix: 'pip install PySide6 && python animation.py' },
  wx: { why: 'needs a desktop window', fix: 'pip install wxPython && python animation.py' },
  requests: { why: 'no network access in the sandbox', fix: 'pip install requests && python animation.py' },
  urllib: { why: 'no network access in the sandbox', fix: 'run locally: python animation.py' },
  urllib3: { why: 'no network access in the sandbox', fix: 'pip install urllib3 && python animation.py' },
  httpx: { why: 'no network access in the sandbox', fix: 'pip install httpx && python animation.py' },
  aiohttp: { why: 'no network access in the sandbox', fix: 'pip install aiohttp && python animation.py' },
  http: { why: 'no network access in the sandbox', fix: 'run locally: python animation.py' },
  socket: { why: 'no network access in the sandbox', fix: 'run locally: python animation.py' },
  socketserver: { why: 'no network access in the sandbox', fix: 'run locally: python animation.py' },
  subprocess: { why: 'processes cannot be spawned in the browser', fix: 'run locally: python animation.py' },
  multiprocessing: { why: 'processes cannot be spawned in the browser', fix: 'run locally: python animation.py' },
  ctypes: { why: 'native extensions are unavailable', fix: 'run locally: python animation.py' },
  webbrowser: { why: 'no browser control from the sandbox', fix: 'run locally: python animation.py' },
  cv2: { why: 'OpenCV needs native libraries', fix: 'pip install opencv-python && python animation.py' },
  torch: { why: 'far too large for a browser runtime', fix: 'pip install torch && python animation.py' },
  tensorflow: { why: 'far too large for a browser runtime', fix: 'pip install tensorflow && python animation.py' },
  moviepy: { why: 'needs ffmpeg', fix: 'pip install moviepy && python animation.py' },
  ffmpeg: { why: 'needs the ffmpeg binary', fix: 'pip install ffmpeg-python && python animation.py' },
  flask: { why: 'needs a server process', fix: 'pip install flask && python animation.py' },
  django: { why: 'needs a server process', fix: 'pip install django && python animation.py' },
  fastapi: { why: 'needs a server process', fix: 'pip install fastapi && python animation.py' },
  uvicorn: { why: 'needs a server process', fix: 'pip install uvicorn && python animation.py' },
  pyaudio: { why: 'needs a sound device', fix: 'pip install pyaudio && python animation.py' },
};

/**
 * Packages ship inside the Pyodide distribution but are not installed by
 * default — they must be requested explicitly with `loadPackage()`.
 * `loadPackagesFromImports()` alone is not enough for matplotlib in current
 * Pyodide; it reports "included in the distribution, but not installed".
 */
export const PYODIDE_BUNDLED: Record<string, string> = {
  numpy: 'numpy',
  matplotlib: 'matplotlib',
  pandas: 'pandas',
  scipy: 'scipy',
  sympy: 'sympy',
  networkx: 'networkx',
  PIL: 'pillow',
  pillow: 'pillow',
  sqlite3: 'sqlite3',
};

/** Distribution package names to preload for a given set of imports. */
export function pyodidePackagesFor(modules: string[]): string[] {
  const packages = new Set<string>();
  for (const name of modules) {
    const mapped = PYODIDE_BUNDLED[name];
    if (mapped) packages.add(mapped);
  }
  return [...packages];
}

const IMPORT_LINE = /^\s*(?:import\s+(.+)|from\s+([A-Za-z_][\w.]*)\s+import)/gm;

/** Every top-level module name imported anywhere in the file. */
export function importedModules(code: string): string[] {
  const found = new Set<string>();

  for (const match of code.matchAll(IMPORT_LINE)) {
    if (match[1]) {
      for (const piece of match[1].split(',')) {
        const name = piece.trim().split(/\s+as\s+/)[0].trim().split('.')[0];
        if (name) found.add(name);
      }
    } else if (match[2]) {
      found.add(match[2].split('.')[0]);
    }
  }
  return [...found];
}

export function analyzePython(code: string): PythonAnalysis {
  const modules = importedModules(code);
  const allowed: string[] = [];
  const blocked: string[] = [];
  const unknown: string[] = [];

  for (const name of modules) {
    if (PYODIDE_BLOCKED[name]) blocked.push(name);
    else if (PYODIDE_ALLOWED.has(name)) allowed.push(name);
    else unknown.push(name);
  }

  const runLocally = [
    'python -m venv .venv',
    ...blocked.map((name) => `pip install ${PYODIDE_BLOCKED[name]?.fix.split(' && ')[0] ?? name}`),
    'python animation.py',
  ];

  if (blocked.length) {
    const reasons = blocked.map((name) => `${name} (${PYODIDE_BLOCKED[name]?.why ?? 'unavailable'})`);
    return {
      verdict: 'unsupported',
      allowed,
      blocked,
      unknown,
      headline: 'Runs locally, not in the browser',
      detail: `This script imports ${reasons.join(', ')}. The in-browser runtime cannot provide that, so the preview is disabled.`,
      runLocally,
    };
  }

  if (unknown.length) {
    return {
      verdict: 'unverified',
      allowed,
      blocked,
      unknown,
      headline: 'Unverified imports — try it',
      detail: `This script imports ${unknown.join(', ')}. Those are not on the known-good list, so the preview may fail.`,
      runLocally: ['python -m venv .venv', ...unknown.map((name) => `pip install ${name}`), 'python animation.py'],
    };
  }

  if (allowed.length === 0) {
    return {
      verdict: 'safe',
      allowed,
      blocked,
      unknown,
      headline: 'Runs in the browser',
      detail: 'Pure standard library — no packages to install.',
      runLocally: ['python animation.py'],
    };
  }

  const installs = allowed.filter(isInstallable).map((name) => `pip install ${name}`);
  return {
    verdict: 'safe',
    allowed,
    blocked,
    unknown,
    headline: 'Runs in the browser',
    detail: `Uses ${allowed.join(', ')} — all available in the in-browser runtime.`,
    runLocally: [...(installs.length ? ['python -m venv .venv', ...installs] : []), 'python animation.py'],
  };
}

/** Only suggest pip for things that are actually third-party. */
const THIRD_PARTY = new Set(['numpy', 'matplotlib', 'pandas', 'scipy', 'sympy', 'networkx', 'PIL', 'pillow', 'pyparsing']);
function isInstallable(name: string): boolean {
  return THIRD_PARTY.has(name);
}
