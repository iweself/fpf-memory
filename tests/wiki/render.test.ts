import { describe, expect, it } from 'vitest';

import { autoLinkPatternIds } from '../../src/wiki/render.js';

const knownIds = new Set(['A.1', 'B.2.3', 'C.1.1:note']);

describe('autoLinkPatternIds', () => {
  it('linkifies known pattern ids in plain text', () => {
    const html = 'Refer to A.1 and B.2.3 for guidance.';
    const result = autoLinkPatternIds(html, knownIds);

    expect(result).toContain('<a href="#/pattern/A.1" class="pattern-ref">A.1</a>');
    expect(result).toContain('<a href="#/pattern/B.2.3" class="pattern-ref">B.2.3</a>');
  });

  it('does not linkify inside anchors or code/pre blocks', () => {
    const html =
      '<a href="#/pattern/A.1">A.1</a> ' +
      '<code>B.2.3</code>' +
      '<pre>C.1.1:note</pre>';
    const result = autoLinkPatternIds(html, knownIds);

    expect(result).toBe(html);
  });

  it('ignores unknown or partial ids', () => {
    const html = 'A.1a should not link; see C.9 which is unknown.';
    const result = autoLinkPatternIds(html, knownIds);

    expect(result).not.toContain('href="#/pattern/A.1a"');
    expect(result).not.toContain('href="#/pattern/C.9"');
    expect(result).toContain('A.1a');
    expect(result).toContain('C.9');
  });
});
