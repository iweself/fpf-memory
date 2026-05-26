import { describe, expect, it } from '@rstest/core';

import {
  buildUpstreamSpecUrl,
  parseUpstreamSpecSourceEnv,
  resolveUpstreamSpecUrl,
} from '../src/build/upstream-source.js';

describe('upstream FPF source resolution', () => {
  it('defaults to Anatoly Levenchuk FPF main spec path', () => {
    expect(buildUpstreamSpecUrl()).toBe(
      'https://raw.githubusercontent.com/ailev/FPF/main/FPF-Spec.md',
    );
  });

  it('uses FPF_UPSTREAM_REF when constructing the download URL', () => {
    const source = parseUpstreamSpecSourceEnv({
      FPF_UPSTREAM_REF: '1234567890abcdef1234567890abcdef12345678',
    } as NodeJS.ProcessEnv);

    expect(source).toMatchObject({
      owner: 'ailev',
      repo: 'FPF',
      ref: '1234567890abcdef1234567890abcdef12345678',
      specPath: 'FPF-Spec.md',
      url: 'https://raw.githubusercontent.com/ailev/FPF/1234567890abcdef1234567890abcdef12345678/FPF-Spec.md',
    });
  });

  it('lets FPF_UPSTREAM_SPEC_URL override the constructed raw URL', () => {
    expect(
      resolveUpstreamSpecUrl({
        ref: '1234567890abcdef1234567890abcdef12345678',
        explicitUrl: 'https://example.test/custom/FPF-Spec.md',
      }),
    ).toBe('https://example.test/custom/FPF-Spec.md');
  });
});
