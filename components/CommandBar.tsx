'use client';

import { useState } from 'react';
import { useSession } from './SessionProvider';
import { Button, Icons, Spinner } from './ui';

/**
 * The prompt lives in the app bar rather than inside each view: generating is
 * the primary action everywhere, and a single input means the header never
 * fights the workspace for vertical space.
 */
export function CommandBar() {
  const { state, generate } = useSession();
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (!value || state.running) return;
    generate(value);
    setText('');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex min-w-0 flex-1 items-center gap-2"
    >
      <div className="relative flex min-w-0 flex-1 items-center">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 text-faint">
          <Icons.spark className="size-4" />
        </span>
        <label className="sr-only" htmlFor="command-prompt">
          Describe an animation
        </label>
        <input
          id="command-prompt"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Describe an animation — e.g. a pulsing neon loader with a soft halo"
          className="h-10 w-full min-w-0 rounded-xl border border-hair bg-raised pl-9 pr-14 text-[13px] text-fg transition placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <span className="pointer-events-none absolute right-3 font-mono text-[10px] text-faint">
          ⌘↵
        </span>
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={state.running || !text.trim()}
        className="h-10 px-4"
        icon={state.running ? <Spinner /> : <Icons.spark className="size-3.5" />}
      >
        {state.running ? 'Generating' : 'Generate five'}
      </Button>
    </form>
  );
}
