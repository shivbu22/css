/**
 * A small, dependency-free tokenizer for display-only syntax highlighting.
 *
 * Design rules:
 *  1. **Never lose text.** `joinTokens(tokenize(code, lang))` always equals `code`.
 *     A highlighter that eats a character is worse than no highlighter, and the
 *     test suite asserts this round-trip for every language.
 *  2. **Never crash.** Anything unrecognised comes back as `plain`.
 *  3. Kinds only, no colours. Themes paint `.tok-*` classes, so both themes share
 *     one tokenizer.
 */

export type Lang = 'css' | 'html' | 'javascript' | 'jsx' | 'python' | (string & {});

export type TokenKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'keyword'
  | 'number'
  | 'tag'
  | 'attr'
  | 'property'
  | 'selector'
  | 'function'
  | 'punctuation';

export interface Token {
  text: string;
  kind: TokenKind;
}

const JS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'new', 'class',
  'extends', 'super', 'import', 'from', 'export', 'default', 'await', 'async', 'try', 'catch',
  'finally', 'throw', 'typeof', 'instanceof', 'delete', 'in', 'of', 'this', 'null', 'undefined',
  'true', 'false', 'switch', 'case', 'break', 'continue', 'yield', 'as', 'void',
]);

const JS_BUILTINS = new Set([
  'console', 'window', 'document', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Promise', 'Map', 'Set', 'Date', 'requestAnimationFrame', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'matchMedia', 'getComputedStyle',
]);

const PY_KEYWORDS = new Set([
  'def', 'class', 'import', 'from', 'as', 'return', 'if', 'elif', 'else', 'for', 'while', 'in',
  'not', 'and', 'or', 'is', 'None', 'True', 'False', 'try', 'except', 'finally', 'with', 'lambda',
  'yield', 'pass', 'break', 'continue', 'raise', 'global', 'nonlocal', 'assert', 'del', 'async',
  'await', 'match', 'case',
]);

const PY_BUILTINS = new Set([
  'print', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple', 'sum',
  'min', 'max', 'abs', 'round', 'enumerate', 'zip', 'sorted', 'reversed', 'any', 'all',
  'isinstance', 'type', 'super', 'open', 'input', 'map', 'filter', 'format', 'repr',
]);

/** Sticky patterns. `matchAt` depends on the `y` flag; without it `exec` would
 *  ignore `lastIndex` and return a match from anywhere in the string. */
const LINE_COMMENT = /\/\/[^\n]*/y;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//y;
const HASH_COMMENT = /#[^\n]*/y;
const HTML_COMMENT = /<!--[\s\S]*?-->/y;
const JS_STRING = /`(?:[^`\\]|\\.)*`?|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/y;
const PY_STRING =
  /[rbufRBUF]{0,2}"""[\s\S]*?(?:"""|$)|[rbufRBUF]{0,2}'''[\s\S]*?(?:'''|$)|[rbufRBUF]{0,2}"(?:[^"\\\n]|\\.)*"?|[rbufRBUF]{0,2}'(?:[^'\\\n]|\\.)*'?/y;
const NUMBER = /\d[\d_]*(?:\.\d+)?(?:e[-+]?\d+)?/y;
const CSS_NUMBER = /\d[\d_]*(?:\.\d+)?(?:%|[a-z]{1,4})?/y;
const HEX_COLOUR = /#[0-9a-fA-F]{3,8}\b/y;
const IDENT = /[A-Za-z_$][\w$]*/y;
const CSS_NAME = /--?[A-Za-z_][\w-]*|[A-Za-z_][\w-]*/y;
const CSS_AT_RULE = /@[\w-]*/y;
const CSS_SELECTOR_RUN = /(?:(?!\/\*)[^{};])+/y;
const PY_NUMBER = /\d[\d_]*(?:\.\d+)?(?:e[-+]?\d+)?j?/y;
const PY_DECORATOR = /@[\w.]+/y;
const HTML_ATTR = /[\w:.-]+/y;
// No `^` anchor: with the sticky flag the match is already pinned to
// `lastIndex`, and an anchor would make it fail for every index > 0.
const WHITESPACE = /\s+/y;

function matchAt(pattern: RegExp, code: string, index: number): string | null {
  pattern.lastIndex = index;
  const match = pattern.exec(code);
  return match ? match[0] : null;
}

function whitespaceAt(code: string, index: number): string {
  const found = matchAt(WHITESPACE, code, index);
  return found ?? '';
}

/* -------------------------------------------------------------------------- */
/* JavaScript / JSX                                                          */
/* -------------------------------------------------------------------------- */

function scanJs(code: string, jsx: boolean): Token[] {
  const tokens: Token[] = [];
  const push = (text: string, kind: TokenKind) => {
    if (text) tokens.push({ text, kind });
  };
  const lastSignificant = (): string => {
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
      const text = tokens[index].text.trim();
      if (text) return text;
    }
    return '';
  };

  let index = 0;
  while (index < code.length) {
    const char = code[index];
    const rest = code.slice(index);

    if (char === '/' && (rest.startsWith('//') || rest.startsWith('/*'))) {
      const comment =
        matchAt(rest.startsWith('//') ? LINE_COMMENT : BLOCK_COMMENT, code, index) ?? char;
      push(comment, 'comment');
      index += comment.length;
      continue;
    }

    if (jsx && char === '<' && code[index + 1] !== '!') {
      const opening = /^<(\/?)([A-Za-z][\w.:]*)/.exec(rest);
      const previous = lastSignificant();
      const afterContext = [
        '(', '=', '=>', 'return', ',', ':', '[', '{', '&&', '||', '?', '>', '',
      ].includes(previous);
      const isComponent = opening ? /[A-Z]/.test(opening[2]) : false;
      const isClosing = opening ? opening[1] === '/' : false;

      if (opening && (isComponent || isClosing || afterContext)) {
        push('<', 'punctuation');
        if (isClosing) push('/', 'punctuation');
        push(opening[2], 'tag');
        index += opening[0].length;

        while (index < code.length && code[index] !== '>') {
          if (code.slice(index, index + 2) === '/>') break;
          const attribute = matchAt(HTML_ATTR, code, index);
          const value = matchAt(JS_STRING, code, index);
          const expression = /^\{[^{}]*\}/.exec(code.slice(index));
          const space = whitespaceAt(code, index);

          if (space) {
            push(space, 'plain');
            index += space.length;
          } else if (value && /["'`]/.test(code[index])) {
            push(value, 'string');
            index += value.length;
          } else if (expression) {
            push(expression[0], 'plain');
            index += expression[0].length;
          } else if (attribute) {
            push(attribute, 'attr');
            index += attribute.length;
          } else {
            push(code[index], 'punctuation');
            index += 1;
          }
        }

        if (code.slice(index, index + 2) === '/>') {
          push('/>', 'punctuation');
          index += 2;
        } else if (code[index] === '>') {
          push('>', 'punctuation');
          index += 1;
        }
        continue;
      }
    }

    if (/["'`]/.test(char)) {
      const string = matchAt(JS_STRING, code, index);
      if (string) {
        push(string, 'string');
        index += string.length;
        continue;
      }
    }

    if (/[0-9]/.test(char)) {
      const number = matchAt(NUMBER, code, index);
      if (number) {
        push(number, 'number');
        index += number.length;
        continue;
      }
    }

    const identifier = matchAt(IDENT, code, index);
    if (identifier) {
      const isCall = /^\s*\(/.test(code.slice(index + identifier.length));
      if (JS_KEYWORDS.has(identifier)) push(identifier, 'keyword');
      else if (JS_BUILTINS.has(identifier) || isCall) push(identifier, 'function');
      else push(identifier, 'plain');
      index += identifier.length;
      continue;
    }

    const space = whitespaceAt(code, index);
    if (space) {
      push(space, 'plain');
      index += space.length;
      continue;
    }

    push(char, 'punctuation');
    index += 1;
  }

  return tokens;
}

/* -------------------------------------------------------------------------- */
/* CSS                                                                        */
/* -------------------------------------------------------------------------- */

function scanCss(code: string): Token[] {
  const tokens: Token[] = [];
  const push = (text: string, kind: TokenKind) => {
    if (text) tokens.push({ text, kind });
  };

  let index = 0;
  let depth = 0;
  // Tracks whether the block we are inside holds declarations (`true`) or is an
  // at-rule wrapper whose children are selectors again (`false`), so @media
  // blocks still highlight their inner selectors.
  const blockStack: boolean[] = [];
  let segmentStart = 0;

  const inDeclarationBlock = (): boolean =>
    blockStack.length > 0 && blockStack[blockStack.length - 1];

  while (index < code.length) {
    const char = code[index];

    if (code.slice(index, index + 2) === '/*') {
      const comment = matchAt(BLOCK_COMMENT, code, index) ?? char;
      push(comment, 'comment');
      index += comment.length;
      continue;
    }

    const space = whitespaceAt(code, index);
    if (space) {
      push(space, 'plain');
      index += space.length;
      continue;
    }

    if (char === '{') {
      const preamble = code.slice(segmentStart, index).trim();
      blockStack.push(!/^@(media|supports|container|layer|scope)\b/.test(preamble));
      push(char, 'punctuation');
      depth += 1;
      index += 1;
      segmentStart = index;
      continue;
    }
    if (char === '}') {
      push(char, 'punctuation');
      depth = Math.max(0, depth - 1);
      blockStack.pop();
      index += 1;
      segmentStart = index;
      continue;
    }
    if (char === ';') {
      push(char, 'punctuation');
      index += 1;
      continue;
    }

    const atRule = matchAt(CSS_AT_RULE, code, index);
    if (atRule && char === '@') {
      push(atRule, 'keyword');
      index += atRule.length;
      continue;
    }

    const hex = matchAt(HEX_COLOUR, code, index);
    if (hex) {
      push(hex, 'number');
      index += hex.length;
      continue;
    }

    if (/["']/.test(char)) {
      const string = matchAt(JS_STRING, code, index);
      if (string) {
        push(string, 'string');
        index += string.length;
        continue;
      }
    }

    if (/\.?\d/.test(code.slice(index, index + 2))) {
      const number = matchAt(CSS_NUMBER, code, index);
      if (number) {
        push(number, 'number');
        index += number.length;
        continue;
      }
    }

    const name = depth > 0 ? matchAt(CSS_NAME, code, index) : null;
    if (name && /[A-Za-z_-]/.test(name[0])) {
      const after = code.slice(index + name.length);
      const isCustomProperty = name.startsWith('--');
      if (/^\s*\(/.test(after)) push(name, 'function');
      else if (inDeclarationBlock() && (isCustomProperty || /^\s*:/.test(after))) push(name, 'property');
      else push(name, 'plain');
      index += name.length;
      continue;
    }

    // Outside a declaration block the rest of the run is selector text, which
    // keeps `.pc-el-core:hover` as one span instead of scattering punctuation.
    if (!inDeclarationBlock()) {
      const selector = matchAt(CSS_SELECTOR_RUN, code, index);
      if (selector) {
        // Keep surrounding whitespace out of the coloured span so the selector
        // itself is a clean token (`.pc-stage`, not `\n.pc-stage `).
        const leading = /^\s*/.exec(selector)?.[0] ?? '';
        const trailing = /\s*$/.exec(selector)?.[0] ?? '';
        const core = selector.slice(leading.length, selector.length - trailing.length);
        if (leading) push(leading, 'plain');
        if (core) push(core, 'selector');
        if (trailing) push(trailing, 'plain');
        index += selector.length;
        continue;
      }
    }

    push(char, 'punctuation');
    index += 1;
  }

  return tokens;
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                       */
/* -------------------------------------------------------------------------- */

function scanHtml(code: string): Token[] {
  const tokens: Token[] = [];
  const push = (text: string, kind: TokenKind) => {
    if (text) tokens.push({ text, kind });
  };

  let index = 0;
  while (index < code.length) {
    const rest = code.slice(index);

    if (rest.startsWith('<!--')) {
      const comment = matchAt(HTML_COMMENT, code, index) ?? '';
      push(comment, 'comment');
      index += comment.length;
      continue;
    }

    if (code[index] === '<') {
      const doctype = /^<!DOCTYPE[^>]*>/i.exec(rest);
      if (doctype) {
        push(doctype[0], 'comment');
        index += doctype[0].length;
        continue;
      }

      const opening = /^<(\/?)([A-Za-z][\w:-]*)/.exec(rest);
      if (opening) {
        const isClosing = opening[1] === '/';
        push('<', 'punctuation');
        if (isClosing) push('/', 'punctuation');
        push(opening[2], 'tag');
        index += opening[0].length;

        while (index < code.length && code[index] !== '>') {
          if (code.slice(index, index + 2) === '/>') break;
          const value = matchAt(JS_STRING, code, index);
          const attribute = matchAt(HTML_ATTR, code, index);
          const space = whitespaceAt(code, index);

          if (space) {
            push(space, 'plain');
            index += space.length;
          } else if (value && /["']/.test(code[index])) {
            push(value, 'string');
            index += value.length;
          } else if (attribute) {
            push(attribute, 'attr');
            index += attribute.length;
          } else {
            push(code[index], 'punctuation');
            index += 1;
          }
        }

        if (code.slice(index, index + 2) === '/>') {
          push('/>', 'punctuation');
          index += 2;
        } else if (code[index] === '>') {
          push('>', 'punctuation');
          index += 1;
        }

        // `<style>` / `<script>` bodies are shown as-is rather than half-parsed.
        if (!isClosing && /^(style|script)$/i.test(opening[2])) {
          const closer = new RegExp(`</${opening[2]}\\s*>`, 'i');
          const remainder = code.slice(index);
          const match = closer.exec(remainder);
          const body = match ? remainder.slice(0, match.index) : remainder;
          if (body) {
            push(body, 'plain');
            index += body.length;
          }
        }
        continue;
      }
    }

    if (code[index] === '&') {
      const entity = /^&[#\w]+;/.exec(rest);
      if (entity) {
        push(entity[0], 'number');
        index += entity[0].length;
        continue;
      }
    }

    const next = code.slice(index).search(/[<&]/);
    const end = next === -1 ? code.length : index + next;
    if (end === index) {
      push(code[index], 'plain');
      index += 1;
    } else {
      push(code.slice(index, end), 'plain');
      index = end;
    }
  }

  return tokens;
}

/* -------------------------------------------------------------------------- */
/* Python                                                                     */
/* -------------------------------------------------------------------------- */

function scanPython(code: string): Token[] {
  const tokens: Token[] = [];
  const push = (text: string, kind: TokenKind) => {
    if (text) tokens.push({ text, kind });
  };

  let index = 0;
  while (index < code.length) {
    const char = code[index];

    if (char === '#') {
      const comment = matchAt(HASH_COMMENT, code, index) ?? char;
      push(comment, 'comment');
      index += comment.length;
      continue;
    }

    if (char === '@') {
      const decorator = matchAt(PY_DECORATOR, code, index) ?? char;
      push(decorator, 'tag');
      index += decorator.length;
      continue;
    }

    if (/["']/.test(char) || /^[rbufRBUF]{1,2}["']/.test(code.slice(index, index + 3))) {
      const string = matchAt(PY_STRING, code, index);
      if (string && string.length > 0) {
        push(string, 'string');
        index += string.length;
        continue;
      }
    }

    if (/[0-9]/.test(char)) {
      const number = matchAt(PY_NUMBER, code, index);
      if (number) {
        push(number, 'number');
        index += number.length;
        continue;
      }
    }

    const identifier = matchAt(IDENT, code, index);
    if (identifier) {
      const isCall = /^\s*\(/.test(code.slice(index + identifier.length));
      const afterDef = /\bdef$/.test(code.slice(0, index).trimEnd());
      if (PY_KEYWORDS.has(identifier)) push(identifier, 'keyword');
      else if (PY_BUILTINS.has(identifier) || isCall || afterDef) push(identifier, 'function');
      else push(identifier, 'plain');
      index += identifier.length;
      continue;
    }

    const space = whitespaceAt(code, index);
    if (space) {
      push(space, 'plain');
      index += space.length;
      continue;
    }

    push(char, 'punctuation');
    index += 1;
  }

  return tokens;
}

/* -------------------------------------------------------------------------- */
/* Entry points                                                               */
/* -------------------------------------------------------------------------- */

export function tokenize(code: string, lang: Lang): Token[] {
  if (!code) return [];

  switch (lang) {
    case 'css':
      return scanCss(code);
    case 'html':
      return scanHtml(code);
    case 'python':
    case 'py':
      return scanPython(code);
    case 'jsx':
    case 'react':
      return scanJs(code, true);
    case 'javascript':
    case 'js':
      return scanJs(code, false);
    default:
      return [{ text: code, kind: 'plain' }];
  }
}

/** Tokenizer output as display lines, so a multi-line token spans correctly. */
export function tokenizeLines(code: string, lang: Lang): Token[][] {
  const lines: Token[][] = [[]];

  for (const token of tokenize(code, lang)) {
    const parts = token.text.split('\n');
    parts.forEach((part, position) => {
      if (position > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind: token.kind });
    });
  }

  return lines;
}

export function joinTokens(tokens: Token[]): string {
  return tokens.map((token) => token.text).join('');
}
