import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface RetrievalSessionState {
  lastNormalizedQuestion: string;
  lastSelectedNodeIds: string[];
  lastSelectedRouteId?: string;
  recentUnresolvedNodeIds: string[];
  updatedAt: string;
}

interface PersistedSessionCache {
  sourceHash: string;
  entries: Array<[string, RetrievalSessionState]>;
}

export interface SessionCacheOptions {
  maxSessions?: number;
  persistPath?: string;
  /** Debounce delay in ms before flushing to disk (default 500). */
  flushDelayMs?: number;
}

export class SessionCache {
  private readonly entries = new Map<string, RetrievalSessionState>();
  private readonly maxSessions: number;
  private readonly persistPath?: string;
  private readonly flushDelayMs: number;
  private sourceHash?: string;
  private flushPromise?: Promise<void>;
  private loadPromise?: Promise<void>;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private hasLoggedWriteError = false;

  constructor(options: SessionCacheOptions = {}) {
    this.maxSessions = options.maxSessions ?? 50;
    this.persistPath = options.persistPath;
    this.flushDelayMs = options.flushDelayMs ?? 500;
  }

  async load(sourceHash: string): Promise<void> {
    if (this.sourceHash === sourceHash) {
      await this.loadPromise;
      return;
    }

    // Await any in-flight load before reassigning to avoid race conditions
    if (this.loadPromise) {
      await this.loadPromise;
    }

    if (this.sourceHash !== undefined) {
      // Cancel any pending flush — entries are about to be cleared so writing them
      // under the new sourceHash would persist stale session context.
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = undefined;
      }
      this.entries.clear();
    }
    this.sourceHash = sourceHash;

    if (!this.persistPath) {
      return;
    }
    this.loadPromise = this.readFromDisk(this.persistPath, sourceHash);
    await this.loadPromise;
  }

  /** Read persisted entries from disk. Path is passed explicitly to avoid non-null assertions. */
  private async readFromDisk(path: string, sourceHash: string): Promise<void> {
    try {
      const raw = await readFile(path, 'utf8');
      const data: PersistedSessionCache = JSON.parse(raw);
      if (data.sourceHash !== sourceHash || this.sourceHash !== sourceHash) {
        return;
      }
      const tuples = data.entries;
      if (!Array.isArray(tuples)) {
        return;
      }
      const start = Math.max(0, tuples.length - this.maxSessions);
      for (let i = start; i < tuples.length; i++) {
        const [key, value] = tuples[i];
        if (!this.entries.has(key)) {
          this.entries.set(key, value);
        }
      }
    } catch {
      // File missing or corrupt — start fresh
    }
  }

  get(sessionId: string): RetrievalSessionState | undefined {
    const value = this.entries.get(sessionId);
    if (!value) {
      return undefined;
    }
    this.entries.delete(sessionId);
    this.entries.set(sessionId, value);
    return value;
  }

  set(sessionId: string, state: RetrievalSessionState): void {
    if (this.entries.has(sessionId)) {
      this.entries.delete(sessionId);
    }
    this.entries.set(sessionId, state);
    while (this.entries.size > this.maxSessions) {
      const oldest = this.entries.keys().next().value;
      if (!oldest) {
        break;
      }
      this.entries.delete(oldest);
    }
    this.scheduleFlush();
  }

  summary(): { enabled: boolean; maxSessions: number; activeSessions: number; persistent: boolean } {
    return {
      enabled: true,
      maxSessions: this.maxSessions,
      activeSessions: this.entries.size,
      persistent: this.persistPath != null,
    };
  }

  /** Debounced flush — batches rapid set() calls into a single disk write. */
  private scheduleFlush(): void {
    if (!this.persistPath || !this.sourceHash) {
      return;
    }
    // Clear any pending debounce timer so we only write once after the last set()
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.doFlush();
    }, this.flushDelayMs);
  }

  private doFlush(): void {
    if (!this.persistPath || !this.sourceHash) {
      return;
    }
    const path = this.persistPath;
    // Capture the hash at flush time so we can verify it hasn't changed
    // between scheduling and the async write completing.
    const hashAtFlush = this.sourceHash;
    const data: PersistedSessionCache = {
      sourceHash: hashAtFlush,
      entries: Array.from(this.entries.entries()),
    };
    const json = JSON.stringify(data);
    this.flushPromise = (this.flushPromise ?? Promise.resolve())
      .then(async () => {
        // If the sourceHash changed while we were waiting, skip this write —
        // the entries were captured under a potentially stale hash.
        if (this.sourceHash !== hashAtFlush) {
          return;
        }
        await mkdir(dirname(path), { recursive: true });
        // Atomic write: write to temp file then rename to avoid corruption on crash
        const tmpPath = join(dirname(path), `.session-cache.tmp.${Date.now()}`);
        await writeFile(tmpPath, json, 'utf8');
        await rename(tmpPath, path);
      })
      .catch((err: unknown) => {
        // Log the first write failure so silent disk issues are visible
        if (!this.hasLoggedWriteError) {
          this.hasLoggedWriteError = true;
          console.error('[SessionCache] disk write failed:', err);
        }
      });
  }
}
