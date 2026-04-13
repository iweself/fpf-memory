import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';

import { FpfRuntime } from '../src/runtime/runtime.js';

/**
 * Tests for the browse / search discovery layer.
 *
 * Verifies filtering, ordering, limits, search scoring, snippet output,
 * and snapshot metadata for the two new public tools.
 */

describe('Discovery layer', () => {
  const canonicalSourcePath = resolve(process.cwd(), 'FPF-spec.md');
  let tempRoot: string;
  let sourcePath: string;
  let artifactDir: string;
  let runtime: FpfRuntime;

  beforeEach(async () => {
    tempRoot = await mkdtemp(resolve(tmpdir(), 'fpf-discovery-'));
    artifactDir = resolve(tempRoot, 'artifacts');
    sourcePath = resolve(tempRoot, 'FPF-spec.md');
    await copyFile(canonicalSourcePath, sourcePath);
    runtime = new FpfRuntime({ sourcePath, artifactDir });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // browse()
  // -----------------------------------------------------------------------

  describe('browse()', () => {
    it('returns entries when no filters are applied', async () => {
      const result = await runtime.browse();
      expect(result.entries.length).toBeGreaterThan(0);
      // total reflects all matching entries; entries may be capped by default limit
      expect(result.total).toBeGreaterThanOrEqual(result.entries.length);
      expect(result.snapshot.sourceHash).toBeTruthy();
      expect(result.snapshot.builtAt).toBeTruthy();
    });

    it('returns entries sorted by id', async () => {
      const result = await runtime.browse();
      const ids = result.entries.map((e) => e.id);
      const sorted = [...ids].sort((a, b) => a.localeCompare(b));
      expect(ids).toEqual(sorted);
    });

    it('filters by kind', async () => {
      const patterns = await runtime.browse({ kind: 'pattern' });
      const routes = await runtime.browse({ kind: 'route' });

      expect(patterns.entries.length).toBeGreaterThan(0);
      expect(routes.entries.length).toBeGreaterThan(0);
      expect(patterns.entries.every((e) => e.kind === 'pattern')).toBe(true);
      expect(routes.entries.every((e) => e.kind === 'route')).toBe(true);
      expect(patterns.filters.kind).toBe('pattern');
    });

    it('filters by part (case-insensitive)', async () => {
      // First discover an actual part value from the data.
      const all = await runtime.browse({ limit: 500 });
      const withPart = all.entries.find((e) => e.part);
      expect(withPart).toBeDefined();

      const partValue = withPart!.part!;
      const filtered = await runtime.browse({ part: partValue, limit: 500 });
      const filteredLower = await runtime.browse({ part: partValue.toLowerCase(), limit: 500 });

      expect(filtered.entries.length).toBeGreaterThan(0);
      expect(filtered.total).toBeLessThan(all.total);
      expect(filtered.entries.every((e) => e.part?.toLowerCase() === partValue.toLowerCase())).toBe(true);
      expect(filtered.entries.length).toBe(filteredLower.entries.length);
    });

    it('respects the limit parameter', async () => {
      const limited = await runtime.browse({ limit: 3 });
      expect(limited.entries.length).toBe(3);
      expect(limited.total).toBeGreaterThan(3);
    });

    it('includes description for each entry', async () => {
      const result = await runtime.browse({ limit: 10 });
      for (const entry of result.entries) {
        expect(typeof entry.description).toBe('string');
        expect(entry.description.length).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // search()
  // -----------------------------------------------------------------------

  describe('search()', () => {
    it('returns ranked hits for a known term', async () => {
      const result = await runtime.search('bounded context');
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.query).toBe('bounded context');
      expect(result.snapshot.sourceHash).toBeTruthy();
    });

    it('returns hits sorted by descending score', async () => {
      const result = await runtime.search('pattern');
      const scores = result.hits.map((h) => h.score);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    it('includes non-empty snippets in hits', async () => {
      const result = await runtime.search('holon');
      expect(result.hits.length).toBeGreaterThan(0);
      for (const hit of result.hits) {
        expect(typeof hit.snippet).toBe('string');
        expect(hit.snippet.length).toBeGreaterThan(0);
      }
    });

    it('filters search results by kind', async () => {
      const all = await runtime.search('pattern');
      const routesOnly = await runtime.search('pattern', { kind: 'route' });

      expect(routesOnly.hits.every((h) => h.kind === 'route')).toBe(true);
      expect(all.total).toBeGreaterThanOrEqual(routesOnly.total);
    });

    it('respects the limit parameter', async () => {
      const result = await runtime.search('pattern', { limit: 2 });
      expect(result.hits.length).toBeLessThanOrEqual(2);
    });

    it('returns zero hits for nonsense query', async () => {
      const result = await runtime.search('zqqxvwjkf');
      expect(result.hits.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('centers snippet on matched term for dotted IDs', async () => {
      const result = await runtime.search('A.1.1');
      const hit = result.hits.find((h) => h.id === 'A.1.1');
      if (hit) {
        // The snippet should contain the ID or related text, not default
        // to the beginning of the node.
        expect(hit.snippet.toLowerCase()).toMatch(/a\.1\.1|boundedcontext|semantic/i);
      }
    });
  });
});
