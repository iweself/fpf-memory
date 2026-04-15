import type { Snapshot } from '../../core/types.js';
import type { ContextId, LifecycleState } from '../../core/governance.js';

export interface GenerateDocsOptions {
  sourcePath?: string;
  docsRoot?: string;
  builtAt?: string;
}

export interface GenerateDocsResult {
  sourcePath: string;
  sourceHash: string;
  builtAt: string;
  docsRoot: string;
  lifecycleState: LifecycleState;
  ownerContext: ContextId;
  generatedFiles: number;
  snapshot: Snapshot;
}

export interface DocsBuildPort {
  generate(options?: GenerateDocsOptions): Promise<GenerateDocsResult>;
}
