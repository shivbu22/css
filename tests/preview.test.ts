import { transform } from 'sucrase';
import { describe, expect, it } from 'vitest';
import {
  PREVIEW_MESSAGE_TYPE,
  buildReactDocument,
  buildWebDocument,
  escapeScript,
  wrapReactModule,
} from '@/lib/core/preview';

/**
 * Runs the generated preview wrapper the way the iframe would, with minimal
 * React/DOM stand-ins. This is the test that proves the whole React path works:
 * Sucrase's CommonJS output, the require shim, component discovery and mount.
 */
function runReactPreview(compiled: string) {
  const rendered: unknown[] = [];
  const reported: string[] = [];

  const React = {
    // Faithful to React: children land in props.children (a single child is not
    // wrapped in an array).
    createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
      type,
      props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
    }),
    Fragment: 'Fragment',
    useState: (initial: unknown) => [initial, () => {}],
    useEffect: () => {},
    useRef: (value: unknown) => ({ current: value }),
  };
  const ReactDOM = {
    createRoot: (container: unknown) => ({
      render: (element: unknown) => {
        rendered.push({ container, element });
      },
    }),
  };

  const window = {
    React,
    ReactDOM,
    quintetReport: (message: string) => reported.push(message),
  };
  const root = { id: 'root' };
  const document = {
    getElementById: (id: string) => (id === 'root' ? root : null),
  };

  new Function('window', 'document', wrapReactModule(compiled))(window, document);
  return { rendered, reported };
}

function compile(source: string): string {
  return transform(source, {
    transforms: ['jsx', 'typescript', 'imports'],
    production: true,
    filePath: 'Component.jsx',
  }).code;
}

describe('react preview pipeline', () => {
  it('compiles a component with hooks and JSX, then mounts it', () => {
    const source = `
      import React, { useEffect, useRef, useState } from 'react';

      export default function NeonPulse() {
        const coreRef = useRef<HTMLDivElement | null>(null);
        const [on] = useState(true);
        useEffect(() => {
          coreRef.current?.animate([] as Keyframe[], { duration: 1400, iterations: Infinity });
        }, []);
        return (
          <div className="pc-stage">
            <div ref={coreRef} className="pc-el-core" data-on={String(on)} />
            <p className="pc-el-label">Loading</p>
          </div>
        );
      }
    `;

    const { rendered, reported } = runReactPreview(compile(source));

    expect(reported).toEqual([]);
    expect(rendered).toHaveLength(1);

    const mounted = rendered[0] as { element: { type: unknown; props: unknown } };
    expect(typeof mounted.element.type).toBe('function');

    // Render the component itself and inspect the tree it returns.
    const Component = mounted.element.type as () => { props: { className: string; children: unknown[] } };
    const tree = Component();
    expect(tree.props.className).toBe('pc-stage');
    expect(tree.props.children).toHaveLength(2);
  });

  it('drops imports the component never uses', () => {
    const source = `import unused from 'some-nonexistent-package';
export default function App() { return <div className="pc-stage" />; }`;
    const compiled = compile(source);
    expect(compiled).not.toContain('some-nonexistent-package');
    const { rendered, reported } = runReactPreview(compiled);
    expect(reported).toEqual([]);
    expect(rendered).toHaveLength(1);
  });

  it('mounts a named export when there is no default export', () => {
    const source = `import React from 'react';\nexport function App() { return <div className="pc-stage" />; }`;
    const { rendered, reported } = runReactPreview(compile(source));
    expect(reported).toEqual([]);
    expect(rendered).toHaveLength(1);
  });

  it('reports a missing component instead of failing silently', () => {
    const { rendered, reported } = runReactPreview(compile('const value = 1;\nexport default value;'));
    expect(rendered).toHaveLength(0);
    expect(reported[0]).toMatch(/No React component/i);
  });

  it('names imports it cannot resolve', () => {
    const source = `import confetti from 'canvas-confetti';\nexport default function App() { confetti(); return <div />; }`;
    const { reported } = runReactPreview(compile(source));
    expect(reported[0]).toMatch(/cannot resolve|canvas-confetti/i);
  });

  it('reports a runtime error thrown by the component body', () => {
    const source = `import React from 'react';\nthrow new Error('boom');\nexport default function App() { return <div />; }`;
    const { rendered, reported } = runReactPreview(compile(source));
    expect(rendered).toHaveLength(0);
    expect(reported[0]).toMatch(/boom/);
  });
});

describe('preview documents', () => {
  it('escapes a closing script tag inside generated JS', () => {
    const js = `document.write("</script><script>alert(1)</script>");`;
    expect(escapeScript(js)).not.toContain('</script>');
    expect(escapeScript(js)).toContain('<\\/script>');
  });

  it('composes html, css and javascript into one document', () => {
    const doc = buildWebDocument({
      html: '<div class="pc-stage"></div>',
      css: '.pc-stage { color: red; }',
      javascript: "document.querySelector('.pc-stage');",
    });
    expect(doc).toContain('<style>\n.pc-stage { color: red; }\n</style>');
    expect(doc).toContain('<div class="pc-stage"></div>');
    expect(doc).toContain("document.querySelector('.pc-stage');");
    expect(doc).toContain(PREVIEW_MESSAGE_TYPE);
  });

  it('falls back to a placeholder when there is no markup yet', () => {
    expect(buildWebDocument({})).toContain('pc-el-subject');
  });

  it('wires the React document to the UMD runtime', () => {
    const doc = buildReactDocument('module.exports = {};');
    expect(doc).toContain('react.production.min.js');
    expect(doc).toContain('react-dom.production.min.js');
    expect(doc).toContain('id="root"');
  });
});
