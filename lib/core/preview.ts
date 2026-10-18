/**
 * Preview documents.
 *
 * Generated code is untrusted, so every preview is a `srcdoc` document inside an
 * iframe with `sandbox="allow-scripts"` and *not* `allow-same-origin`: the frame
 * gets an opaque origin, cannot touch cookies/storage, and cannot reach into the
 * parent. Errors are reported back with postMessage since we cannot read across
 * the boundary.
 */

export const REACT_CDN = {
  react: 'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  reactDom: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
} as const;

export const PREVIEW_MESSAGE_TYPE = 'quintet:preview-error';

const BASE_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    background: #070b14;
    color: #e6edf7;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: 24px;
  }
  /* Full-bleed preview: no centring or padding, so page-scale artifacts get the
     whole canvas instead of a padded card. */
  body.quintet-stretch { display: block; padding: 0; }
  body.quintet-stretch > .pc-stage { min-height: 100vh; }
  .pc-stage { position: relative; display: grid; place-items: center; }
  #quintet-error {
    position: fixed; inset: auto 12px 12px 12px;
    display: none; padding: 10px 12px; border-radius: 8px;
    background: #3b0d16; border: 1px solid #7f1d1d; color: #fecdd3;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap; max-height: 40vh; overflow: auto;
  }
`;

/** Inline scripts must not be terminated early by a literal `</script>` in code. */
export function escapeScript(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

const ERROR_BRIDGE = `<script>
(function () {
  function report(message) {
    try { parent.postMessage({ type: ${JSON.stringify(PREVIEW_MESSAGE_TYPE)}, message: String(message) }, '*'); } catch (error) {}
    var box = document.getElementById('quintet-error');
    if (box) { box.style.display = 'block'; box.textContent = String(message); }
  }
  window.quintetReport = report;
  window.addEventListener('error', function (event) {
    report((event && (event.message || (event.error && event.error.message))) || 'Script error');
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    report((reason && (reason.stack || reason.message)) || String(reason || 'Unhandled rejection'));
  });
})();
</script>`;

function page(title: string, body: string, bodyClass = 'quintet-preview'): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${BASE_STYLE}</style>
</head>
<body class="${bodyClass}">
<div id="quintet-error"></div>
${body}
</body>
</html>`;
}

export interface WebDocumentInput {
  html?: string;
  css?: string;
  javascript?: string;
  /** `center` frames the artifact; `stretch` gives it the whole canvas. */
  layout?: 'center' | 'stretch';
}

/**
 * Composite preview: the HTML artifact provides markup, the CSS artifact styles
 * it, the JS artifact animates it — the three really do run together.
 */
export function buildWebDocument({
  html,
  css,
  javascript,
  layout = 'center',
}: WebDocumentInput): string {
  const style = css ? `<style>\n${css}\n</style>` : '';
  const markup = html ?? '<div class="pc-stage"><div class="pc-el-subject">Preview</div></div>';
  const script = javascript
    ? `${ERROR_BRIDGE}\n<script>\n${escapeScript(javascript)}\n</script>`
    : ERROR_BRIDGE;
  const bodyClass = layout === 'stretch' ? 'quintet-preview quintet-stretch' : 'quintet-preview';

  return page('Quintet preview', `${style}\n${markup}\n${script}`, bodyClass);
}

/**
 * Wraps Sucrase-compiled JSX so it can run as a classic script.
 *
 * The compiled module is CommonJS-shaped (`require('react')`, `exports.default`),
 * so it is executed inside a tiny module loader backed by the React UMD globals.
 */
export function wrapReactModule(compiled: string): string {
  return `(function () {
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  if (!React || !ReactDOM) {
    window.quintetReport('React could not be loaded from the CDN — the preview needs network access.');
    return;
  }

  function asModule(value) {
    var mod = {};
    for (var key in value) { mod[key] = value[key]; }
    mod.default = value;
    mod.__esModule = true;
    return mod;
  }

  var jsxRuntime = {
    jsx: React.createElement,
    jsxs: React.createElement,
    jsxDEV: React.createElement,
    Fragment: React.Fragment
  };

  var registry = {
    'react': asModule(React),
    'react-dom': asModule(ReactDOM),
    'react-dom/client': asModule({ createRoot: ReactDOM.createRoot, hydrateRoot: ReactDOM.hydrateRoot }),
    'react/jsx-runtime': asModule(jsxRuntime),
    'react/jsx-dev-runtime': asModule(jsxRuntime)
  };

  function require(name) {
    var key = String(name);
    if (registry[key]) return registry[key];
    throw new Error('The preview cannot resolve the import "' + key + '". Keep the component self-contained and import only from react.');
  }

  var module = { exports: {} };
  var exports = module.exports;

  try {
    (function (module, exports, require, React, ReactDOM) {
${compiled}
    })(module, exports, require, React, ReactDOM);
  } catch (error) {
    window.quintetReport(error && error.stack ? error.stack : error);
    return;
  }

  function pickComponent(exported) {
    if (!exported) return null;
    if (typeof exported === 'function') return exported;
    var candidates = [exported.default, exported.App, exported.Component, exported.default_];
    for (var i = 0; i < candidates.length; i += 1) {
      if (typeof candidates[i] === 'function') return candidates[i];
    }
    for (var name in exported) {
      if (typeof exported[name] === 'function' && /^[A-Z]/.test(name)) return exported[name];
    }
    return null;
  }

  var Component = pickComponent(module.exports);
  if (!Component) {
    window.quintetReport('No React component found. The file must export a component as default.');
    return;
  }

  try {
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
  } catch (error) {
    window.quintetReport(error && error.stack ? error.stack : error);
  }
})();`;
}

export function buildReactDocument(compiled: string): string {
  const body = [
    '<div id="root"></div>',
    ERROR_BRIDGE,
    `<script src="${REACT_CDN.react}"></script>`,
    `<script src="${REACT_CDN.reactDom}"></script>`,
    `<script>${escapeScript(wrapReactModule(compiled))}</script>`,
  ].join('\n');

  return page('Quintet preview — React', body);
}

/** For HTML produced by the Python runner (matplotlib `to_jshtml()`). */
export function buildHtmlDocument(html: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  return page('Quintet preview — Python', html);
}

/** Template used before anything has been generated. */
export function buildEmptyDocument(message = 'Nothing to preview yet.'): string {
  return page(
    'Quintet preview',
    `<div class="pc-stage" style="opacity:.6;font-size:13px">${message}</div>`,
  );
}
