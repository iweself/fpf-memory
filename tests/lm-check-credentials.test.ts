import { describe, expect, it } from '@rstest/core';

import { resolveLmCheckApiKey } from '../src/composition/cli-runner.js';

describe('resolveLmCheckApiKey', () => {
  it('returns explicit CLI api key even when base URL is overridden', () => {
    expect(
      resolveLmCheckApiKey({
        commandBaseUrl: 'http://localhost:9999/v1',
        envBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        commandApiKey: 'cli-token',
        envApiKey: 'env-token',
      }),
    ).toBe('cli-token');
  });

  it('drops env api key when CLI overrides base URL without a CLI key', () => {
    expect(
      resolveLmCheckApiKey({
        commandBaseUrl: 'http://localhost:9999/v1',
        envBaseUrl: 'http://localhost:1234/v1',
        commandApiKey: undefined,
        envApiKey: 'super-secret',
      }),
    ).toBeUndefined();
  });

  it('forwards env api key when base URL is not overridden', () => {
    expect(
      resolveLmCheckApiKey({
        commandBaseUrl: undefined,
        envBaseUrl: 'http://localhost:1234/v1',
        commandApiKey: undefined,
        envApiKey: 'from-env',
      }),
    ).toBe('from-env');
  });

  it('forwards env api key when CLI base URL matches env default', () => {
    expect(
      resolveLmCheckApiKey({
        commandBaseUrl: 'http://localhost:1234/v1',
        envBaseUrl: 'http://localhost:1234/v1',
        commandApiKey: undefined,
        envApiKey: 'from-env',
      }),
    ).toBe('from-env');
  });
});
