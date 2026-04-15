import { describe, expect, it } from '@rstest/core';

import { parseCliCommand } from '../src/adapters/cli/command-contracts.js';

describe('CLI command contracts', () => {
  it('keeps option values out of positional query questions', () => {
    const command = parseCliCommand([
      'query',
      'What',
      'is',
      'U.BoundedContext?',
      '--mode',
      'compact',
      '--session',
      's1',
    ]);

    expect(command).toEqual({
      kind: 'query',
      question: 'What is U.BoundedContext?',
      mode: 'compact',
      forceRefresh: false,
      sessionId: 's1',
    });
  });

  it('keeps option values out of positional inspect selectors', () => {
    const command = parseCliCommand(['inspect', 'A.1.1', '--kind', 'id']);

    expect(command).toEqual({
      kind: 'inspect',
      selector: 'A.1.1',
      selectorKind: 'id',
      forceRefresh: false,
    });
  });

  it('rejects missing explicit flag values instead of consuming the next flag', () => {
    let thrown: unknown;
    try {
      parseCliCommand(['query', '--question', '--mode', 'verbose']);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
  });
});
