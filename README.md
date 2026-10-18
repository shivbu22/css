# Quintet — one prompt, five coordinated builds

Type *"a pulsing neon loader with a soft halo"* and get **CSS, HTML, JavaScript, React and Python** that all describe the *same* animation — previewable in the browser, refinable per tab, and runnable locally against Ollama.

The coordination is the point. Most "prompt → code" tools emit one file per prompt; Quintet plans a **design brief** first and then renders every target from that brief plus a deterministic **structure contract** (class names, keyframe names, palette, timing). That is why the React version and the CSS version actually match.

---

## Quickstart

```bash
npm install

# 1) start Ollama and pull a coder model (one time)
ollama serve
ollama pull qwen3-coder

# 2) run the app
npm run dev          # http://localhost:3210
```

No model yet? Demo mode serves a fixed, working generation so the UI and every preview path can be exercised:

```bash
QUINTET_FAKE=1 npm run dev     # PowerShell: $env:QUINTET_FAKE=1; npm run dev
```

If Ollama is down, the app says so in the banner and names the exact commands to fix it — generation is never silently broken.

---

## How it works

```
prompt ──▶ brief stage (one small call, guided JSON)
                │  {name, elements[], keyframes[], palette, easing, durationMs}
                ▼
        structure contract  (.pc-el-*, pc-key-*, colours, timing)
                │
                ▼
   five concurrent target calls, each with its own system prompt + few-shots
                │
                ▼
   NDJSON stream: brief → target-start → target-delta… → target-done → done
                │
                ▼
   web preview (one sandboxed frame) · React preview · Python runner
```

- **Failure isolation:** one target failing blanks one tab, never the run.
- **Repair:** empty or implausible output triggers one retry with a nudge.
- **Polish pass (opt-in):** draft → self-critique → fix, available per artifact.
- **Refine:** sends the brief + that one file, never the whole workspace.

The engine (`lib/core/orchestrate.ts`) is shared by both runtimes — the only thing that differs is where the model runs.

---

## Three views, one session

Chat, Five-up and Focus are three renderings of the same reducer (`lib/core/session.ts`), so a refine typed in chat updates the tabs and a re-roll in Focus lands in the transcript. Sessions persist to `localStorage`.

| View | Use it for |
|---|---|
| **Five-up** | All five artifacts: tab strip with status pills, code pane, live preview, refine bar |
| **Focus** | One artifact larger, with **Polish this artifact** as the primary action |
| **Chat** | Iterating by talking, scoped to all five targets or one |

---

## Two runtimes

| | Server runtime (default) | Client runtime (`npm run build:static`) |
|---|---|---|
| Model | Ollama on your machine | WebLLM (WebGPU) in the tab |
| Needs a server | yes (Next route handlers) | no — static files only |
| Output | `npm run build` | `out/`, deployable anywhere |
| Quality | as good as your local model | weaker; 1–4 GB one-time weight download |

The client runtime is the *distribution* mode (no install, no server), not the quality mode — the UI says so rather than pretending otherwise.

---

## How each target previews

| Target | Preview |
|---|---|
| **CSS / HTML / JS** | one sandboxed `<iframe srcdoc>`: the HTML provides markup, the CSS styles it, the JS animates it — they really do run together |
| **React** | JSX → JS via Sucrase (route handler, or in-browser for the static build), mounted with React 18 UMD behind a tiny module shim |
| **Python** | Pyodide in the tab: stdout console, captured matplotlib figures, and `FuncAnimation` → animated HTML |

### Sandboxing

Generated code is untrusted. Every preview is `sandbox="allow-scripts"` **without** `allow-same-origin`, so the frame gets an opaque origin: no cookies, no storage, no reaching into the parent. Errors are reported back with `postMessage` and shown as a dismissible banner.

### Python runner notes

- Pyodide is loaded on demand from **`https://cdn.jsdelivr.net/pyodide/v<version>/full/pyodide.mjs`**. Use that path, *not* the npm mirror: mirrored wheels fail subresource-integrity checks against Pyodide's lock file, so `loadPackage` resolves while installing nothing and the import fails later with a confusing "included in the distribution, but it is not installed".
- Because a silent no-op install is possible, every requested module is verified with `find_spec` after loading, with `micropip` as a fallback.
- Imports are classified before running: known-good (stdlib, numpy, matplotlib, pandas, scipy) → runs; unknown → "unverified" warning; desktop/network (`turtle`, `pygame`, `manim`, `requests`, sockets) → preview disabled with the exact local commands to run the script instead. "Run anyway" is available for the stubborn.
- A runaway loop means reloading the tab — there is no worker timeout yet.

---

## Environment

Copy `.env.local.example` to `.env.local`. Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `qwen3-coder` | Default model |
| `OLLAMA_NUM_CTX` / `OLLAMA_KEEP_ALIVE` | `8192` / `15m` | Context window; keeps the model warm across the five targets |
| `GENERATION_TEMPERATURE` | `0.2` | Low, deliberately — this is code, not prose |
| `MAX_TARGET_TOKENS` | `2048` | Per-target reply cap |
| `TARGET_TIMEOUT_MS` | `240000` | Per-target timeout |
| `GENERATE_RATE_LIMIT_PER_MIN` | `30` | In-memory sliding window (single process) |
| `QUINTET_FAKE` | unset | `1` = canned generations, no model calls |
| `NEXT_PUBLIC_RUNTIME` | `server` | `client` for the browser-only build |
| `NEXT_PUBLIC_PYODIDE_URL` | Pyodide CDN path | Override the Python runtime |
| `NEXT_PUBLIC_WEBLLM_MODEL` | small Qwen coder | Browser model |

---

## Scripts

```bash
npm run dev           # dev server on :3210
npm run build         # production build
npm run build:static  # browser-only static export → out/
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest (48 tests)
```

`build:static` parks `app/api` for the duration of the build (a static export cannot contain route handlers) and restores it afterwards, even on failure.

---

## Tests

`npx vitest run` — 48 tests over the parts where bugs actually hide:

- **`parse`** — fenced, prefixed, malformed and unclosed model output; prose trimming that must never eat real code; the streaming delta filter.
- **`preview`** — the React pipeline end to end: real Sucrase output evaluated through the module shim, asserting a component is discovered and mounted, that unused imports are dropped, that unresolvable imports are *named*, and that thrown errors are reported instead of failing silently.
- **`brief`** — JSON extraction, schema defaults and violations, fallback brief, and contract determinism.
- **`session`** — fan-out, per-target error isolation, versioned re-rolls, refines, persistence round-trip.
- **`pyodideSafe`** — import extraction and the safe/unverified/unsupported verdicts.

---

## Known limits

- A local model's output quality is the ceiling. Mitigations in place: the brief stage, temperature 0.2, per-target few-shots, one repair retry, the Polish pass, and visible per-tab re-roll.
- The Python runner executes on the main thread; a hard timeout needs a worker.
- The rate limiter is per-process, in memory — fine for one local user, not a hosted service.
- React previews need network access for the React UMD scripts; web previews need it for nothing.

## Not built (deliberately)

Accounts, credits/Stripe billing, a public API/SDK, a shared gallery, hosted GPU inference, thumbnails and SEO pages. Those are the runway once this earns it.
