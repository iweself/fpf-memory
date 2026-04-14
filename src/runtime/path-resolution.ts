import { statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RuntimePathKind = 'file' | 'directory' | 'any';

export interface RuntimePathResolutionOptions {
  cwd?: string;
  moduleUrl?: string;
  fallbackRoot?: string;
  kind?: RuntimePathKind;
}

export interface ResolvedRuntimePath {
  path: string;
  root: string;
  existed: boolean;
}

export function resolveRuntimePath(
  rawPath: string,
  options: RuntimePathResolutionOptions = {},
): ResolvedRuntimePath {
  const trimmedPath = rawPath.trim();
  const kind = options.kind ?? 'any';

  if (isAbsolute(trimmedPath)) {
    const absolutePath = resolve(trimmedPath);
    return {
      path: absolutePath,
      root: kind === 'directory' ? absolutePath : dirname(absolutePath),
      existed: pathMatchesKind(absolutePath, kind),
    };
  }

  const discoveryRoots = unique([
    ...ancestorRoots(resolve(options.cwd ?? process.cwd())),
    ...ancestorRoots(dirname(fileURLToPath(options.moduleUrl ?? import.meta.url))),
  ]);

  for (const root of discoveryRoots) {
    const candidate = resolve(root, trimmedPath);
    if (pathMatchesKind(candidate, kind)) {
      return {
        path: candidate,
        root,
        existed: true,
      };
    }
  }

  const fallbackRoot = resolve(options.fallbackRoot ?? discoveryRoots[0] ?? process.cwd());
  return {
    path: resolve(fallbackRoot, trimmedPath),
    root: fallbackRoot,
    existed: false,
  };
}

function ancestorRoots(startPath: string): string[] {
  const roots: string[] = [];
  let current = resolve(startPath);

  while (true) {
    roots.push(current);
    const parent = dirname(current);
    if (parent === current) {
      return roots;
    }
    current = parent;
  }
}

function pathMatchesKind(path: string, kind: RuntimePathKind): boolean {
  try {
    const stats = statSync(path);
    switch (kind) {
      case 'file':
        return stats.isFile();
      case 'directory':
        return stats.isDirectory();
      default:
        return true;
    }
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
