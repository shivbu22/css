/**
 * Demo provider (QUINTET_FAKE=1).
 *
 * Serves a fixed, genuinely working generation — one coordinated neon loader —
 * so the UI, the previews and the Python runner can be exercised without a model
 * loaded. Also the shape a test double would take for CI.
 */
import type { ChatFn, ChatMessage, ModelCatalog } from '@/lib/core/types';

export const FAKE_BRIEF = {
  name: 'Neon Pulse Loader',
  summary: 'A soft cyan core that pulses while a halo ring expands and fades behind it.',
  elements: [
    { name: 'Core', description: 'the bright pulsing dot at the centre' },
    { name: 'Halo', description: 'a thin ring that expands and fades on every beat' },
    { name: 'Label', description: 'small uppercase caption under the loader' },
  ],
  keyframes: [
    { name: 'pulse', from: 'transform: scale(.9); opacity: .85', to: 'transform: scale(1.05); opacity: 1' },
    { name: 'halo', from: 'transform: scale(.7); opacity: .9', to: 'transform: scale(1.6); opacity: 0' },
  ],
  palette: ['#22d3ee', '#0b1020', '#e2e8f0'],
  easing: 'cubic-bezier(.4, 0, .2, 1)',
  durationMs: 1400,
  loop: true,
  notes: ['the label should stay calm while everything else breathes'],
};

const FAKE_HTML = `<div class="pc-stage" role="img" aria-label="Pulsing neon loader">
  <div class="pc-el-halo" aria-hidden="true"></div>
  <div class="pc-el-core" aria-hidden="true"></div>
  <p class="pc-el-label">Loading</p>
</div>`;

const FAKE_CSS = `.pc-stage {
  --pc-accent: #22d3ee;
  --pc-ink: #0b1020;
  --pc-text: #e2e8f0;
  --pc-duration: 1400ms;
  position: relative;
  display: grid;
  justify-items: center;
  gap: 20px;
  padding: 32px;
}

.pc-el-core {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #eafeff, var(--pc-accent) 58%, var(--pc-ink) 100%);
  box-shadow: 0 0 44px rgba(34, 211, 238, 0.55);
  animation: pc-key-pulse var(--pc-duration) cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.pc-el-halo {
  position: absolute;
  top: 32px;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 1px solid rgba(34, 211, 238, 0.55);
  animation: pc-key-halo var(--pc-duration) cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.pc-el-label {
  margin: 0;
  font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--pc-text);
  opacity: 0.7;
}

@keyframes pc-key-pulse {
  from { transform: scale(0.9); opacity: 0.85; }
  to { transform: scale(1.05); opacity: 1; }
}

@keyframes pc-key-halo {
  from { transform: scale(0.7); opacity: 0.9; }
  to { transform: scale(1.6); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .pc-el-core,
  .pc-el-halo { animation-duration: 4200ms; }
}`;

const FAKE_JS = `(function () {
  const stage = document.querySelector('.pc-stage');
  if (!stage) return;

  const core = stage.querySelector('.pc-el-core');
  const halo = stage.querySelector('.pc-el-halo');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beat = reduce ? 4200 : 1400;

  if (core) {
    core.animate(
      [{ transform: 'scale(.9)', opacity: 0.85 }, { transform: 'scale(1.05)', opacity: 1 }],
      { duration: beat, direction: 'alternate', iterations: Infinity, easing: 'cubic-bezier(.4,0,.2,1)' },
    );
  }

  if (halo) {
    const ring = halo.animate(
      [{ transform: 'scale(.7)', opacity: 0.9 }, { transform: 'scale(1.6)', opacity: 0 }],
      { duration: beat, iterations: Infinity, easing: 'cubic-bezier(.4,0,.2,1)' },
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ring.pause();
      else ring.play();
    });
  }
})();`;

const FAKE_REACT = `import { useEffect, useRef } from 'react';

const ACCENT = '#22d3ee';

const STAGE = {
  position: 'relative',
  display: 'grid',
  justifyItems: 'center',
  gap: 20,
  padding: 32,
} as const;

const CORE = {
  width: 84,
  height: 84,
  borderRadius: '50%',
  background: \`radial-gradient(circle at 32% 28%, #eafeff, \${ACCENT} 58%, #0b1020 100%)\`,
  boxShadow: '0 0 44px rgba(34, 211, 238, 0.55)',
} as const;

const HALO = {
  position: 'absolute',
  top: 32,
  width: 84,
  height: 84,
  borderRadius: '50%',
  border: '1px solid rgba(34, 211, 238, 0.55)',
} as const;

const LABEL = {
  margin: 0,
  font: '600 11px/1 ui-sans-serif, system-ui, sans-serif',
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: '#e2e8f0',
  opacity: 0.7,
} as const;

/**
 * Deliberately self-contained: the contract class names are kept so this can sit
 * next to the CSS and HTML artifacts, but every rule is inline because the React
 * preview does not load the CSS artifact.
 */
export default function NeonPulseLoader() {
  const coreRef = useRef(null);
  const haloRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const beat = reduce ? 4200 : 1400;
    const options = {
      duration: beat,
      iterations: Infinity,
      easing: 'cubic-bezier(.4,0,.2,1)',
    };

    const core = coreRef.current?.animate(
      [{ transform: 'scale(.9)', opacity: 0.85 }, { transform: 'scale(1.05)', opacity: 1 }],
      { ...options, direction: 'alternate' },
    );
    const halo = haloRef.current?.animate(
      [{ transform: 'scale(.7)', opacity: 0.9 }, { transform: 'scale(1.6)', opacity: 0 }],
      options,
    );

    return () => {
      core?.cancel();
      halo?.cancel();
    };
  }, []);

  return (
    <div className="pc-stage" style={STAGE} role="img" aria-label="Pulsing neon loader">
      <div ref={haloRef} className="pc-el-halo" style={HALO} aria-hidden="true" />
      <div ref={coreRef} className="pc-el-core" style={CORE} aria-hidden="true" />
      <p className="pc-el-label" style={LABEL}>
        Loading
      </p>
    </div>
  );
}`;

const FAKE_PYTHON = `"""Neon pulse loader — matplotlib rendition of the same brief."""

import math
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

ACCENT = "#22d3ee"
INK = "#0b1020"
TEXT = "#e2e8f0"
DURATION_MS = 1400
FRAMES = 48


def build_figure():
    fig, ax = plt.subplots(figsize=(4, 4), dpi=110)
    fig.patch.set_facecolor(INK)
    ax.set_facecolor(INK)
    ax.set_xlim(-2, 2)
    ax.set_ylim(-2, 2)
    ax.set_aspect("equal")
    ax.axis("off")

    core, = ax.plot([], [], marker="o", markersize=16, color=ACCENT, alpha=0.95)
    halo, = ax.plot([], [], marker="o", markersize=22, fillstyle="none",
                    markeredgecolor=ACCENT, markeredgewidth=1.2)
    return fig, core, halo


def build_animation(fig, core, halo):
    def update(frame):
        phase = frame / FRAMES
        beat = (math.sin(phase * 2 * math.pi) + 1) / 2
        core.set_data([0], [0])
        core.set_markersize(14 + beat * 4)
        core.set_alpha(0.82 + beat * 0.18)
        halo.set_data([0], [0])
        halo.set_markersize(18 + beat * 26)
        halo.set_alpha(max(0.0, 0.75 - beat * 0.75))
        return core, halo

    return FuncAnimation(fig, update, frames=FRAMES, interval=DURATION_MS / FRAMES, blit=False)


if __name__ == "__main__":
    figure, core_artist, halo_artist = build_figure()
    anim = build_animation(figure, core_artist, halo_artist)
    print(f"Neon pulse loader: {FRAMES} frames, {DURATION_MS}ms per cycle")
`;

const MARKERS: Array<{ test: RegExp; body: string }> = [
  { test: /Target: a single CSS stylesheet/, body: FAKE_CSS },
  { test: /Target: an HTML fragment/, body: FAKE_HTML },
  { test: /Target: one vanilla JavaScript file/, body: FAKE_JS },
  { test: /Target: one self-contained React component/, body: FAKE_REACT },
  { test: /Target: one standalone Python script/, body: FAKE_PYTHON },
];

function respond(messages: ChatMessage[]): string {
  const system = messages[0]?.content ?? '';
  if (/strict code reviewer/i.test(system)) return 'OK';
  if (/motion designer writing a build spec/i.test(system)) return JSON.stringify(FAKE_BRIEF, null, 2);

  for (const marker of MARKERS) {
    if (marker.test.test(system)) return marker.body;
  }
  return FAKE_CSS;
}

/** Same interface as `ollamaChat`, no model involved. */
export async function* fakeChat(
  messages: ChatMessage[],
  _options: { signal?: AbortSignal },
): AsyncGenerator<string> {
  const body = respond(messages);
  const size = 90;
  for (let index = 0; index < body.length; index += size) {
    if (_options.signal?.aborted) return;
    yield body.slice(index, index + size);
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

export function fakeCatalog(defaultModel: string): ModelCatalog {
  return {
    models: ['demo (canned output)'],
    defaultModel: 'demo',
    reachable: true,
    fake: true,
    note: `QUINTET_FAKE=1 — serving canned output instead of calling ${defaultModel}.`,
  };
}
