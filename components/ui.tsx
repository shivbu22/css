'use client';

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { ArtifactStatus } from '@/lib/core/session';
import { cn } from '@/lib/ui/cn';

/* -------------------------------------------------------------------------- */
/* Icons — inline so the bundle stays free of an icon dependency               */
/* -------------------------------------------------------------------------- */

type IconProps = { className?: string };

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-4 shrink-0', className)}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  spark: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" />
      <path d="M18.5 3.5v3M17 5h3" />
    </Svg>
  ),
  canvas: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </Svg>
  ),
  grid: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </Svg>
  ),
  chat: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 14.5a3 3 0 0 1-3 3H9l-5 3.5V6.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />
    </Svg>
  ),
  sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Svg>
  ),
  moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a7.2 7.2 0 1 0 11.1 11.1z" />
    </Svg>
  ),
  plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  ),
  copy: (p: IconProps) => (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M15 5.5H6.5A2.5 2.5 0 0 0 4 8v8.5" />
    </Svg>
  ),
  download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
    </Svg>
  ),
  refresh: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.6 10.5a7.5 7.5 0 0 1 12.6-4L20 9" />
      <path d="M20 4.5V9h-4.5" />
      <path d="M19.4 13.5a7.5 7.5 0 0 1-12.6 4L4 15" />
      <path d="M4 19.5V15h4.5" />
    </Svg>
  ),
  wand: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 19 15.5 8.5" />
      <path d="M16.5 3.5v3M20.5 7.5h-3M18.5 5.5l-2 2" />
      <path d="M4.5 12.5h-2M7 10l-1.5-1.5" />
    </Svg>
  ),
  play: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 5.5v13l11-6.5z" />
    </Svg>
  ),
  external: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14 5h5v5M19 5l-7 7" />
      <path d="M18 14v4.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H11" />
    </Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12.5 9.5 17 19 7" />
    </Svg>
  ),
  alert: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4 3.5 19h17z" />
      <path d="M12 10v4M12 16.8h.01" />
    </Svg>
  ),
  shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6z" />
      <path d="M9.5 12.2 11.5 14l3.5-3.6" />
    </Svg>
  ),
  terminal: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7.5 9.5 10 12l-2.5 2.5M12.5 15h4" />
    </Svg>
  ),
  image: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17.5l4.8-4.8 3.7 3.7 2.6-2.2 4.9 4.3" />
    </Svg>
  ),
  wrap: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h11a3 3 0 1 1 0 6H7" />
      <path d="M9.5 10.5 7 13l2.5 2.5" />
      <path d="M4 17h6" />
    </Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  ),
  chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9.5 6.5 15 12l-5.5 5.5" />
    </Svg>
  ),
  dot: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
    </Svg>
  ),
};

/* -------------------------------------------------------------------------- */
/* Buttons and controls                                                       */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'default' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

export function Button({ variant = 'default', className, icon, children, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-accent';
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-accent-tint text-accent-soft ring-1 ring-inset ring-accent hover:bg-accent hover:text-canvas',
    default: 'bg-raised text-fg ring-1 ring-inset ring-hair hover:ring-edge',
    ghost: 'text-muted hover:bg-raised hover:text-fg',
  };
  return (
    <button type="button" className={cn(base, variants[variant], className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  className,
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-0.5 rounded-lg bg-raised p-0.5 ring-1 ring-inset ring-hair', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          title={option.title ?? option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition',
            option.value === value
              ? 'bg-panel text-fg shadow-[0_1px_2px_rgba(0,0,0,0.25)] ring-1 ring-inset ring-hair'
              : 'text-muted hover:text-fg',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent',
        className,
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  flat,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flat?: boolean;
}) {
  return (
    <section className={cn(flat ? 'panel-flat' : 'panel', 'flex min-h-0 flex-col', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {typeof title === 'string' ? (
              <h2 className="truncate text-[12.5px] font-semibold text-fg">{title}</h2>
            ) : (
              title
            )}
            {typeof subtitle === 'string' && subtitle ? (
              <span className="truncate text-[11px] text-faint">{subtitle}</span>
            ) : (
              subtitle
            )}
          </div>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Banner({
  tone = 'info',
  children,
  actions,
  icon,
}: {
  tone?: 'info' | 'warn' | 'error';
  children: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: 'bg-accent-tint text-accent-soft border-accent',
    warn: 'bg-warn-tint text-warn border-warn',
    error: 'bg-err-tint text-err border-err',
  }[tone];

  return (
    <div
      role="status"
      className={cn('flex flex-wrap items-center gap-2 border-b px-3 py-2 text-[12px]', tones)}
    >
      {icon ?? <Icons.dot className="size-2.5" />}
      <span className="min-w-0 flex-1">{children}</span>
      {actions}
    </div>
  );
}

export function StatusDot({
  status,
  tone,
  className,
}: {
  status?: ArtifactStatus;
  tone?: 'ok' | 'warn' | 'err' | 'muted' | 'accent';
  className?: string;
}) {
  const resolved =
    tone ??
    ({ pending: 'muted', streaming: 'accent', ready: 'ok', error: 'err' } as const)[status ?? 'pending'];

  const colours = {
    ok: 'bg-ok',
    warn: 'bg-warn',
    err: 'bg-err',
    muted: 'bg-faint',
    accent: 'bg-accent',
  }[resolved];

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        colours,
        status === 'streaming' ? 'animate-pulse' : '',
        className,
      )}
    />
  );
}

export function StatusBadge({ status }: { status: ArtifactStatus }) {
  const label = { pending: 'idle', streaming: 'live', ready: 'ready', error: 'failed' }[status];
  return (
    <span className="chip">
      <StatusDot status={status} />
      {label}
    </span>
  );
}

export function Chip({
  children,
  tone,
  className,
  title,
}: {
  children: ReactNode;
  tone?: 'accent' | 'ok' | 'warn' | 'err';
  className?: string;
  title?: string;
}) {
  const tones = {
    accent: 'bg-accent-tint text-accent-soft ring-accent',
    ok: 'bg-ok-tint text-ok ring-ok',
    warn: 'bg-warn-tint text-warn ring-warn',
    err: 'bg-err-tint text-err ring-err',
  };
  return (
    <span
      title={title}
      className={cn('chip', tone ? tones[tone] : '', tone ? 'ring-1 ring-inset' : '', className)}
    >
      {children}
    </span>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-hair bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-mono text-[11px] text-muted">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-faint">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Code actions                                                               */
/* -------------------------------------------------------------------------- */

export function CopyButton({
  text,
  label = 'Copy',
  compact,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  if (compact) {
    return (
      <IconButton label={copied ? 'Copied' : 'Copy to clipboard'} onClick={copy} disabled={!text}>
        {copied ? <Icons.check className="size-4 text-ok" /> : <Icons.copy />}
      </IconButton>
    );
  }

  return (
    <Button icon={<Icons.copy className="size-3.5" />} onClick={copy} disabled={!text}>
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function DownloadButton({
  text,
  filename,
  label = 'Download',
  compact,
}: {
  text: string;
  filename: string;
  label?: string;
  compact?: boolean;
}) {
  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (compact) {
    return (
      <IconButton label={`Download ${filename}`} onClick={download} disabled={!text}>
        <Icons.download />
      </IconButton>
    );
  }

  return (
    <Button icon={<Icons.download className="size-3.5" />} onClick={download} disabled={!text}>
      {label}
    </Button>
  );
}
