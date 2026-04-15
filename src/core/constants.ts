/** Default when `FPF_SPEC_SOURCE_PATH` is unset; populated by `bun run spec:download`. */
export const DEFAULT_SOURCE_PATH = '.fpf-upstream/FPF-Spec.md';
/** Hosted bundles stage the spec under the same relative path the runtime uses by default. */
export const HOSTED_STAGED_SOURCE_PATH = DEFAULT_SOURCE_PATH;
export const DEFAULT_ARTIFACT_DIR = '.runtime/fpf-index';

export const ARTIFACT_FILENAMES = {
  snapshot: 'snapshot.json',
  buildAudit: 'build-audit.json',
  indexMap: 'index-map.json',
  patternGraph: 'pattern-graph.json',
  routeGraph: 'route-graph.json',
  lexicon: 'lexicon.json',
  anchorMap: 'anchor-map.json',
  indexingView: 'indexing-view.json',
} as const;

export const SESSION_CACHE_FILENAME = 'session-cache.json';

export const PREFACE_MARKER = '# **Preface** (non-normative)';
export const PREFACE_ROUTE_CITATION = 'Preface/Where to start';
export const ROUTE_INDEX_CITATION = 'J.4';

export const PROJECT_ALIGNMENT_ROUTE_NAME = 'project alignment';

export const MAX_HOPS = 6;
export const MAX_SELECTED_ANCHORS = 12;
export const MAX_EXCLUDED = 5;
export const MAX_SYNTHESIS_SLICES = 8;

export const PART_C_LABEL = 'Part C - Kernel Extension Specifications';

export const PART_C_CLUSTER_LABELS = [
  'Cluster C.I - Core CALs / LOGs / CHRs',
  'Cluster C.II - Domain-Specific Patterns',
  'Cluster C.III - Meta-Infrastructure CALs',
  'Cluster C.IV - Composite & Macro-Scale',
] as const;
