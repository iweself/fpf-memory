import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

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
}

export class SessionCache {
  private readonly entries = new Map<string, RetrievalSessionState>();
  private readonly maxSessions: number;
  private readonly persistPath?: string;
  private sourceHash?: string;
  private flushPromise?: Promise<void>;
  private loadPromise?: Promise<void>;

  constructor(options: SessionCacheOptions = {}) {
    this.maxSessions = options.maxSessions ?? 50;
    this.persistPath = options.persistPath;
  }

  async load(sourceHash: string): Promise<void> {
    if (this.sourceHash === sourceHash) {
      await this.loadPromise;
      return;
    }

    if (this.sourceHash !== undefined) {
      this.entries.clear();
    }
    this.sourceHash = sourceHash;

    if (!this.persistPath) {
      return;
    }
    this.loadPromise = this.readFromDisk(sourceHash);
    await this.loadPromise;
  }

  private async readFromDisk(sourceHash: string): Promise<void> {
    try {
      const raw = await readFile(this.persistPath!, 'utf8');
      const data: PersistedSessionCache = JSON.parse(raw);
      if (data.sourceHash !== sourceHash || this.sourceHash !== sourceHash) {
        return;
      }
      const tuples = data.entries;
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

  private scheduleFlush(): void {
    if (!this.persistPath || !this.sourceHash) {
      return;
    }
    const path = this.persistPath;
    const data: PersistedSessionCache = {
      sourceHash: this.sourceHash,
      entries: Array.from(this.entries.entries()),
    };
    const json = JSON.stringify(data);
    this.flushPromise = (this.flushPromise ?? Promise.resolve())
      .then(async () => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, json, 'utf8');
      })
      .catch(() => {
        // Best-effort persistence — don't crash on write failure
      });
  }
}
