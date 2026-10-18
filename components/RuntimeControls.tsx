'use client';

import { QUALITY_PRESETS } from '@/lib/core/quality';
import type { Quality } from '@/lib/core/types';
import { useSession } from './SessionProvider';
import { ThemeToggle } from './ThemeToggle';
import { Chip, Icons, IconButton, Segmented, StatusDot } from './ui';

export function RuntimeControls() {
  const { state, setModel, setQuality, catalog, catalogLoading, runtime, reset } = useSession();

  const reachable = catalog?.reachable ?? false;
  const models = catalog?.models ?? [];
  const selected = state.model || catalog?.defaultModel || '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip
        tone={reachable ? 'ok' : 'err'}
        title={catalog?.note ?? runtime.placement}
      >
        <StatusDot tone={reachable ? 'ok' : 'err'} />
        {runtime.label}
      </Chip>

      <label className="sr-only" htmlFor="model">
        Model
      </label>
      <select
        id="model"
        value={selected}
        onChange={(event) => setModel(event.target.value)}
        className="h-8 max-w-[190px] truncate rounded-lg border border-hair bg-raised px-2 text-[12px] text-fg transition focus:border-accent focus:outline-none"
      >
        {catalogLoading ? <option value="">Loading models…</option> : null}
        {!catalogLoading && !models.length ? (
          <option value={catalog?.defaultModel ?? ''}>{catalog?.defaultModel ?? 'no model'}</option>
        ) : null}
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>

      <Segmented<Quality>
        value={state.quality}
        onChange={setQuality}
        options={[
          { value: 'draft', label: 'Draft', title: QUALITY_PRESETS.draft.blurb },
          { value: 'polished', label: 'Polish', title: QUALITY_PRESETS.polished.blurb },
        ]}
      />

      <ThemeToggle />

      <IconButton label="New session" onClick={reset} disabled={!state.prompt}>
        <Icons.plus />
      </IconButton>
    </div>
  );
}
