'use client';

import { useEffect } from 'react';
import type { SessionMode } from '@/lib/core/session';
import { TARGETS } from '@/lib/core/types';
import { CanvasView } from './CanvasView';
import { ChatView } from './ChatView';
import { CommandBar } from './CommandBar';
import { GridView } from './GridView';
import { RuntimeControls } from './RuntimeControls';
import { useSession } from './SessionProvider';
import { Banner, Button, Icons, Segmented } from './ui';

const MODES: Array<{ value: SessionMode; label: string; icon: React.ReactNode; title: string }> = [
  { value: 'canvas', label: 'Canvas', icon: <Icons.canvas className="size-3.5" />, title: 'Preview-first workspace (⌘1–5 switches artifact)' },
  { value: 'grid', label: 'Grid', icon: <Icons.grid className="size-3.5" />, title: 'All five artifacts at a glance' },
  { value: 'chat', label: 'Chat', icon: <Icons.chat className="size-3.5" />, title: 'Iterate by talking' },
];

function RuntimeBanner() {
  const { state, catalog, catalogLoading, runtime } = useSession();
  if (catalogLoading || !catalog) return null;

  if (runtime.id === 'client') {
    return (
      <Banner icon={<Icons.shield className="size-3.5" />}>
        Browser model mode: weights download once, then are cached by the tab. Same engine, weaker
        model than a local coder — the server build is the quality mode.
      </Banner>
    );
  }

  if (catalog.fake) {
    return (
      <Banner icon={<Icons.spark className="size-3.5" />}>
        {catalog.note ?? 'Demo mode: canned generations.'}
      </Banner>
    );
  }

  if (!catalog.reachable || !catalog.models.length) {
    return (
      <Banner tone="warn" icon={<Icons.alert className="size-3.5" />}>
        {catalog.reachable
          ? 'Ollama is up but has no models.'
          : (catalog.note ?? 'Ollama is not reachable.')}{' '}
        Run{' '}
        <code className="rounded bg-raised px-1 font-mono text-[11px]">
          ollama pull {catalog.defaultModel}
        </code>
      </Banner>
    );
  }

  if (state.error) {
    return (
      <Banner tone="error" icon={<Icons.alert className="size-3.5" />}>
        {state.error}
      </Banner>
    );
  }

  return null;
}

export function Workspace() {
  const { state, setMode, setFocus, cancel } = useSession();
  const { mode } = state;

  // ⌘1…⌘5 jump straight to an artifact.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const index = Number.parseInt(event.key, 10);
      if (!Number.isInteger(index) || index < 1 || index > TARGETS.length) return;
      event.preventDefault();
      setFocus(TARGETS[index - 1]);
      setMode('canvas');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setFocus, setMode]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-hair bg-panel px-3 py-2.5">
        <span className="flex items-center gap-2 pr-1">
          <span aria-hidden="true" className="orb size-4 animate-orb rounded-full" />
          <span className="text-[13px] font-semibold tracking-tight text-fg">Quintet</span>
        </span>

        <div className="min-w-[220px] flex-1">
          <CommandBar />
        </div>

        <Segmented<SessionMode> value={mode} onChange={setMode} options={MODES} />

        {state.running ? (
          <Button variant="ghost" onClick={cancel} icon={<Icons.close className="size-3.5" />}>
            Cancel
          </Button>
        ) : null}

        <RuntimeControls />
      </header>

      <RuntimeBanner />

      <main className="flex min-h-0 flex-1 flex-col p-3">
        {mode === 'canvas' ? <CanvasView /> : null}
        {mode === 'grid' ? <GridView /> : null}
        {mode === 'chat' ? <ChatView /> : null}
      </main>
    </div>
  );
}
