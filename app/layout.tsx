import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quintet — one prompt, five coordinated builds',
  description:
    'Turn one prompt into coordinated CSS, HTML, JavaScript, React and Python implementations of the same animation, with live previews.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07090f' },
    { media: '(prefers-color-scheme: light)', color: '#f5f6fa' },
  ],
};

/** Applied before first paint so the theme never flashes. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('quintet:theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
