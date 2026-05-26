import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from '@rstest/core';

describe('sync FPF publication workflow', () => {
  it('keeps fpf.sh current from Anatoly Levenchuk FPF plus six-hour polling', async () => {
    const workflow = await readFile(
      resolve(process.cwd(), '.github/workflows/sync-fpf.yml'),
      'utf8',
    );

    expect(workflow).toContain('repository_dispatch:');
    expect(workflow).toContain('types: [fpf-origin-updated]');
    expect(workflow).toContain("- cron: '0 */6 * * *'");
    expect(workflow).toContain('ailev/FPF');
    expect(workflow).not.toContain('venikman');
  });

  it('passes one resolved upstream ref to download and publish', async () => {
    const workflow = await readFile(
      resolve(process.cwd(), '.github/workflows/sync-fpf.yml'),
      'utf8',
    );

    expect(workflow).toContain('id: upstream');
    expect(workflow).toContain(
      'FPF_UPSTREAM_REF: ${{ steps.upstream.outputs.ref }}',
    );
    expect(workflow).toContain(
      'FPF_UPSTREAM_SPEC_URL: ${{ steps.upstream.outputs.spec_url }}',
    );
    expect(workflow).toContain('spec_url requires client_payload.sha/after/ref/branch');
  });
});
