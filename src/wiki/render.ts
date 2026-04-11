import { Marked } from 'marked';

const marked = new Marked({
  gfm: true,
  breaks: false,
});

export function renderMarkdownToHtml(markdown: string): string {
  const raw = marked.parse(markdown);
  if (typeof raw !== 'string') {
    return '';
  }
  return raw;
}

const PATTERN_ID_RE =
  /(?<!\w)([A-K]\.\d+(?:\.\d+)*(?:\.[A-Za-z]+(?:\.[A-Za-z]+)*)?)(?!\w)/g;

export function autoLinkPatternIds(
  html: string,
  knownIds: Set<string>,
): string {
  const insideTag = /<[^>]*>/g;
  const parts: Array<{ text: string; isTag: boolean }> = [];
  let lastIndex = 0;

  for (const match of html.matchAll(insideTag)) {
    if (match.index > lastIndex) {
      parts.push({ text: html.slice(lastIndex, match.index), isTag: false });
    }
    parts.push({ text: match[0], isTag: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < html.length) {
    parts.push({ text: html.slice(lastIndex), isTag: false });
  }

  let inAnchor = false;
  let inCode = false;
  const result: string[] = [];

  for (const part of parts) {
    if (part.isTag) {
      const lower = part.text.toLowerCase();
      if (lower.startsWith('<a ') || lower === '<a>') {
        inAnchor = true;
      } else if (lower === '</a>') {
        inAnchor = false;
      } else if (lower.startsWith('<code') || lower.startsWith('<pre')) {
        inCode = true;
      } else if (lower === '</code>' || lower === '</pre>') {
        inCode = false;
      }
      result.push(part.text);
      continue;
    }

    if (inAnchor || inCode) {
      result.push(part.text);
      continue;
    }

    result.push(
      part.text.replace(PATTERN_ID_RE, (_match, id: string) => {
        if (knownIds.has(id)) {
          return `<a href="#/pattern/${encodeURIComponent(id)}" class="pattern-ref">${id}</a>`;
        }
        return id;
      }),
    );
  }

  return result.join('');
}

export function collectKnownIds(
  patternNodes: Record<string, unknown>,
): Set<string> {
  return new Set(Object.keys(patternNodes));
}
