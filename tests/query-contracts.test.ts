import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from '@rstest/core';

import { compileFpfSource } from '../src/runtime/compiler.js';
import { QueryEngine } from '../src/runtime/query-engine.js';
import type { LocalAnswerSynthesizer, Snapshot } from '../src/runtime/types.js';

/**
 * Stage-local contract tests for the query pipeline.
 *
 * Each test targets a specific retrieval stage promise so that a failure
 * pinpoints the broken stage rather than surfacing as a generic
 * "end-to-end answer is wrong."
 */

let cachedSnapshot: Snapshot | undefined;

async function getSnapshot(): Promise<Snapshot> {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }
  const sourcePath = resolve(process.cwd(), 'FPF-spec.md');
  const sourceText = await readFile(sourcePath, 'utf8');
  const sourceHash = createHash('sha256').update(sourceText).digest('hex');
  const output = compileFpfSource({
    sourcePath,
    sourceHash,
    builtAt: new Date().toISOString(),
    sourceText,
  });
  cachedSnapshot = output.snapshot;
  return cachedSnapshot;
}

function engine(snapshot: Snapshot, synthesizer?: LocalAnswerSynthesizer): QueryEngine {
  return new QueryEngine(snapshot, false, synthesizer);
}

// ---------------------------------------------------------------------------
// Stage 1: Normalizer
// ---------------------------------------------------------------------------
describe('Query / Normalizer stage', () => {
  it('detects explicit IDs in the question', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('What is A.1.1?');

    expect(trace.detected.ids).toContain('A.1.1');
    expect(trace.normalizedQuestion.length).toBeGreaterThan(0);
  });

  it('detects route names when mentioned in the question', async () => {
    const snapshot = await getSnapshot();
    const routeNames = Object.values(snapshot.routeGraph.nodes).map((r) => r.name);
    const firstRoute = routeNames[0];

    if (firstRoute) {
      const trace = engine(snapshot).trace(`Tell me about the ${firstRoute} route`);
      expect(trace.detected.routeNames).toContain(firstRoute);
    }
  });

  it('detects status terms present in the status index', async () => {
    const snapshot = await getSnapshot();
    const statusKeys = Object.keys(snapshot.indexes.statusIndex);

    if (statusKeys.length > 0) {
      const firstStatus = statusKeys[0]!;
      const trace = engine(snapshot).trace(`Show me ${firstStatus} patterns`);
      expect(trace.detected.statusTerms).toContain(firstStatus);
    }
  });

  it('returns empty signals for a nonsense question', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('xyzzy plugh');

    expect(trace.detected.ids).toEqual([]);
    expect(trace.detected.routeNames).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Stage 2: Candidate seeder
// ---------------------------------------------------------------------------
describe('Query / Seed coverage stage', () => {
  it('seeds exact-match candidates when explicit IDs are in the question', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('What is A.1.1?');

    const exactCandidate = trace.candidateScores.find((c) => c.nodeId === 'A.1.1');
    expect(exactCandidate).toBeDefined();
    expect(exactCandidate!.reasons).toContain('exact-id');
    expect(exactCandidate!.score).toBeGreaterThanOrEqual(100);
  });

  it('seeds lexical candidates for keyword-rich queries', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('How does bounded context relate to role assignment?');

    const lexicalFrontier = trace.frontierCandidates.filter((c) => c.origin === 'lexical');
    expect(lexicalFrontier.length).toBeGreaterThan(0);
  });

  it('seeds route expansion candidates for route-bearing queries', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace(
      'What is the first practical route when vocabulary is overloaded across teams?',
    );

    const routeCandidates = trace.candidateScores.filter((c) => c.kind === 'route');
    expect(routeCandidates.length).toBeGreaterThan(0);
  });

  it('produces few or low-scoring candidates for a completely unrelated question', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('xyzzy plugh');

    // Index description overlap may still surface some weak candidates.
    // The contract is that no candidate scores above the exact-match
    // threshold (100) and total count stays low relative to the full catalog.
    const highScoring = trace.candidateScores.filter((c) => c.score >= 100);
    expect(highScoring.length).toBe(0);
    expect(trace.candidateScores.length).toBeLessThan(
      Object.keys(snapshot.compiledNodes).length / 2,
    );
  });
});

// ---------------------------------------------------------------------------
// Stage 3: Candidate ranker
// ---------------------------------------------------------------------------
describe('Query / Ranker stage', () => {
  it('ranks exact-ID matches above lexical matches', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('What is A.1.1?');

    const scores = trace.candidateScores;
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0]!.nodeId).toBe('A.1.1');
  });

  it('selects the expected initial node IDs for an explicit ID query', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('What is A.1.1?');

    expect(trace.selectedNodeIds).toContain('A.1.1');
  });

  it('selects a route node when route intent is clear', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace(
      'What is the first practical route when vocabulary is overloaded across teams?',
    );

    const routeNodes = trace.selectedNodeIds.filter(
      (id) => snapshot.compiledNodes[id]?.kind === 'route',
    );
    expect(routeNodes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Stage 4: Frontier expansion bounds
// ---------------------------------------------------------------------------
describe('Query / Frontier expansion stage', () => {
  it('respects the MAX_HOPS budget (≤6 retrieval hops)', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace(
      'How do U.RoleAssignment, U.BoundedContext, and U.RoleStateGraph connect in a lawful workflow?',
    );

    expect(trace.retrievalHops.length).toBeLessThanOrEqual(6);
  });

  it('respects the MAX_SELECTED_ANCHORS budget (≤12 anchors)', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('What is A.1.1?');

    expect(trace.selectedAnchorIds.length).toBeLessThanOrEqual(12);
  });

  it('records hop metadata (iteration, reason, added nodes/anchors)', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace(
      'How do U.RoleAssignment, U.BoundedContext, and U.RoleStateGraph connect in a lawful workflow?',
    );

    if (trace.retrievalHops.length > 0) {
      const firstHop = trace.retrievalHops[0]!;
      expect(firstHop.iteration).toBe(1);
      expect(firstHop.reason.length).toBeGreaterThan(0);
      expect(typeof firstHop.sufficientAfter).toBe('boolean');
    }
  });

  it('marks sufficiency correctly — sufficient traces have anchors', async () => {
    const snapshot = await getSnapshot();
    const trace = engine(snapshot).trace('What is A.1.1?');

    if (trace.sufficient) {
      expect(trace.selectedAnchorIds.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Stage 5: Answer projection stability
// ---------------------------------------------------------------------------
describe('Query / Projection stability stage', () => {
  it('produces stable support set across repeated queries', async () => {
    const snapshot = await getSnapshot();
    const eng = engine(snapshot);

    const trace1 = eng.trace('What is A.1.1?');
    const trace2 = eng.trace('What is A.1.1?');

    expect(trace1.selectedNodeIds).toEqual(trace2.selectedNodeIds);
    expect(trace1.selectedAnchorIds).toEqual(trace2.selectedAnchorIds);
    expect(trace1.candidateScores.map((c) => c.nodeId)).toEqual(
      trace2.candidateScores.map((c) => c.nodeId),
    );
  });

  it('projects a non-empty answer with citations for a known pattern query', async () => {
    const snapshot = await getSnapshot();
    const result = await engine(snapshot).query('What is A.1.1?', 'verbose');

    expect(result.status).toBe('ok');
    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.ids).toContain('A.1.1');
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('projects constraints for verbose mode', async () => {
    const snapshot = await getSnapshot();
    const result = await engine(snapshot).query('What is A.1.1?', 'verbose');

    expect(result.constraints.length).toBeGreaterThanOrEqual(1);
  });

  it('projects a grounding chain in proof mode', async () => {
    const snapshot = await getSnapshot();
    const result = await engine(snapshot).query('What is A.1.1?', 'proof');

    expect(result.groundingChain).toBeDefined();
    expect(result.groundingChain!.length).toBeGreaterThan(0);
  });

  it('returns low-confidence status for completely unresolvable questions', async () => {
    const snapshot = await getSnapshot();
    const result = await engine(snapshot).query('xyzzy plugh nonsense', 'compact');

    // Weak index-description overlap may still produce ambiguous candidates,
    // so the engine may return 'ambiguous' or 'not_found'.  The contract is
    // that confidence stays below the high-confidence threshold.
    expect(['not_found', 'ambiguous']).toContain(result.status);
    expect(result.confidence).toBeLessThan(0.7);
  });
});

// ---------------------------------------------------------------------------
// Stage 6: Synthesis isolation
// ---------------------------------------------------------------------------
describe('Query / Synthesis isolation stage', () => {
  it('returns deterministic answer when synthesizer is unavailable', async () => {
    const snapshot = await getSnapshot();
    const unavailable: LocalAnswerSynthesizer = {
      isAvailable: async () => false,
      synthesize: async () => {
        throw new Error('should not be called');
      },
    };

    const result = await engine(snapshot, unavailable).query('What is A.1.1?', 'verbose');

    expect(result.status).toBe('ok');
    expect(result.ids).toContain('A.1.1');
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it('falls back to deterministic answer when synthesizer throws', async () => {
    const snapshot = await getSnapshot();
    const failing: LocalAnswerSynthesizer = {
      isAvailable: async () => true,
      synthesize: async () => {
        throw new Error('synthesizer crashed');
      },
    };

    const result = await engine(snapshot, failing).query('What is A.1.1?', 'verbose');

    expect(result.status).toBe('ok');
    expect(result.ids).toContain('A.1.1');
    expect(result.gaps.some((gap) => gap.includes('synthesis skipped') || gap.includes('synthesizer crashed'))).toBe(true);
  });

  it('does not alter deterministic IDs or citations when synthesis fails', async () => {
    const snapshot = await getSnapshot();
    const eng = engine(snapshot);
    const deterministicResult = await eng.query('What is A.1.1?', 'verbose');

    const failing: LocalAnswerSynthesizer = {
      isAvailable: async () => true,
      synthesize: async () => {
        throw new Error('test failure');
      },
    };
    const failedSynthResult = await engine(snapshot, failing).query('What is A.1.1?', 'verbose');

    expect(failedSynthResult.ids).toEqual(deterministicResult.ids);
    expect(failedSynthResult.citations).toEqual(deterministicResult.citations);
    expect(failedSynthResult.relations).toEqual(deterministicResult.relations);
  });

  it('does not call synthesize when synthesizer reports unavailable', async () => {
    const snapshot = await getSnapshot();
    let synthesizeCalled = false;
    const unavailable: LocalAnswerSynthesizer = {
      isAvailable: async () => false,
      synthesize: async () => {
        synthesizeCalled = true;
        return {};
      },
    };

    await engine(snapshot, unavailable).query('What is A.1.1?', 'compact');

    expect(synthesizeCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trace determinism (cross-cutting)
// ---------------------------------------------------------------------------
describe('Query / Trace determinism', () => {
  it('same snapshot + same query → identical trace structure', async () => {
    const snapshot = await getSnapshot();
    const eng = engine(snapshot);

    const trace1 = eng.trace('How does bounded context relate to role assignment?', 'verbose');
    const trace2 = eng.trace('How does bounded context relate to role assignment?', 'verbose');

    expect(JSON.stringify(trace1)).toBe(JSON.stringify(trace2));
  });
});
