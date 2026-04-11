import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { compileFpfSource } from '../runtime/compiler.js';
import { createHash } from 'node:crypto';
import type {
  AnchorRef,
  IndexMapNode,
  PatternRecord,
  RelationEdge,
  RouteRecord,
  Snapshot,
} from '../runtime/types.js';
import {
  autoLinkPatternIds,
  collectKnownIds,
  renderMarkdownToHtml,
} from './render.js';
import { generateAppShell } from './template.js';

const SOURCE_PATH = resolve(process.cwd(), 'FPF-spec.md');
const ARTIFACT_DIR = resolve(process.cwd(), '.runtime/fpf-index');
const SNAPSHOT_PATH = resolve(ARTIFACT_DIR, 'snapshot.json');
const OUTPUT_DIR = resolve(process.cwd(), 'dist/wiki');

export interface TreeNode {
  id: string;
  title: string;
  patternId?: string;
  status?: string;
  children: TreeNode[];
}

export interface PatternSection {
  heading: string;
  role: string;
  html: string;
}

export interface PatternPage {
  id: string;
  title: string;
  status?: string;
  part?: string;
  cluster?: string;
  type?: string;
  normativity?: string;
  keywords: string[];
  aliases: string[];
  relations: Array<{ from: string; relation: string; to: string }>;
  sections: PatternSection[];
}

export interface SearchEntry {
  id: string;
  title: string;
  keywords: string[];
  aliases: string[];
  part?: string;
  status?: string;
}

export interface RoutePageStep {
  id: string;
  title: string;
}

export interface RoutePage {
  id: string;
  name: string;
  description: string;
  steps: RoutePageStep[];
}

async function loadOrBuildSnapshot(): Promise<Snapshot> {
  try {
    const content = await readFile(SNAPSHOT_PATH, 'utf8');
    const snapshot = JSON.parse(content) as Snapshot;
    const sourceText = await readFile(SOURCE_PATH, 'utf8');
    const hash = `sha256:${createHash('sha256').update(sourceText).digest('hex')}`;
    if (snapshot.sourceHash === hash) {
      console.log('Using existing snapshot (hash matches).');
      return snapshot;
    }
    console.log('Source hash changed, recompiling…');
    return compile(sourceText, hash);
  } catch {
    console.log('No snapshot found, compiling…');
    const sourceText = await readFile(SOURCE_PATH, 'utf8');
    const hash = `sha256:${createHash('sha256').update(sourceText).digest('hex')}`;
    return compile(sourceText, hash);
  }
}

function compile(sourceText: string, hash: string): Snapshot {
  const { snapshot } = compileFpfSource({
    sourcePath: SOURCE_PATH,
    sourceHash: hash,
    builtAt: new Date().toISOString(),
    sourceText,
  });
  return snapshot;
}

function buildTreeData(snapshot: Snapshot): TreeNode[] {
  const groups: TreeNode[] = [];
  const indexMap = snapshot.indexMap;
  const roots = snapshot.indexRoots;
  const patternNodes = snapshot.patternGraph.nodes;

  for (const rootId of roots) {
    const rootNode = indexMap[rootId];
    if (!rootNode) continue;

    const title = cleanTitle(rootNode.title);
    if (isTableOrMetaRoot(title)) continue;

    const children: TreeNode[] = [];
    collectPatternChildren(rootNode, indexMap, patternNodes, children);

    if (children.length === 0 && !rootNode.metadata?.patternId) {
      // Preface-like section: add itself as a child
      if (rootNode.childIds.length > 0) {
        for (const childId of rootNode.childIds) {
          const child = indexMap[childId];
          if (!child) continue;
          children.push({
            id: child.anchorId || child.id,
            title: cleanTitle(child.title),
            patternId: child.metadata?.patternId,
            status: child.metadata?.patternId
              ? patternNodes[child.metadata.patternId]?.status
              : undefined,
            children: [],
          });
        }
      }
    }

    if (children.length > 0) {
      groups.push({ id: rootId, title, children });
    }
  }

  return groups;
}

function collectPatternChildren(
  node: IndexMapNode,
  indexMap: Record<string, IndexMapNode>,
  patternNodes: Record<string, PatternRecord>,
  out: TreeNode[],
): void {
  for (const childId of node.childIds) {
    const child = indexMap[childId];
    if (!child) continue;

    if (child.metadata?.patternId) {
      const pattern = patternNodes[child.metadata.patternId];
      out.push({
        id: child.metadata.patternId,
        title: cleanTitle(child.title),
        patternId: child.metadata.patternId,
        status: pattern?.status,
        children: [],
      });
    } else if (child.level <= 2) {
      collectPatternChildren(child, indexMap, patternNodes, out);
    }
  }
}

function buildPatternPage(
  patternId: string,
  snapshot: Snapshot,
  knownIds: Set<string>,
): PatternPage {
  const pattern = snapshot.patternGraph.nodes[patternId];
  const indexNode = findIndexNodeForPattern(patternId, snapshot.indexMap);
  const sections: PatternSection[] = [];

  if (indexNode) {
    for (const childId of indexNode.childIds) {
      const childNode = snapshot.indexMap[childId];
      if (!childNode) continue;
      const anchor = snapshot.anchorMap[childNode.anchorId || childNode.id];
      if (!anchor || !anchor.text.trim()) continue;

      let html = renderMarkdownToHtml(anchor.text);
      html = autoLinkPatternIds(html, knownIds);
      sections.push({
        heading: cleanSectionHeading(childNode.title),
        role: childNode.metadata?.role ?? 'other',
        html,
      });
    }
  }

  // If no sections from index, try the anchor directly
  if (sections.length === 0) {
    const anchor = snapshot.anchorMap[patternId];
    if (anchor && anchor.text.trim()) {
      let html = renderMarkdownToHtml(anchor.text);
      html = autoLinkPatternIds(html, knownIds);
      sections.push({ heading: 'Content', role: 'other', html });
    }
  }

  const relations: PatternPage['relations'] = [];
  if (pattern) {
    for (const edge of snapshot.relationGraph) {
      if (
        (edge.from === patternId || edge.to === patternId) &&
        edge.relation !== 'outline_parent' &&
        edge.relation !== 'outline_child' &&
        edge.relation !== 'outline_prev_sibling' &&
        edge.relation !== 'outline_next_sibling'
      ) {
        relations.push({
          from: edge.from,
          relation: edge.relation,
          to: edge.to,
        });
      }
    }
  }

  return {
    id: patternId,
    title: pattern?.title ?? indexNode?.title ?? patternId,
    status: pattern?.status,
    part: pattern?.part,
    cluster: pattern?.cluster,
    type: pattern?.type,
    normativity: pattern?.normativity,
    keywords: pattern?.keywords ?? [],
    aliases: pattern?.aliases ?? [],
    relations,
    sections,
  };
}

function buildPrefacePage(
  nodeId: string,
  snapshot: Snapshot,
  knownIds: Set<string>,
): PatternPage {
  const anchor = snapshot.anchorMap[nodeId];
  const indexNode = snapshot.indexMap[nodeId];
  const sections: PatternSection[] = [];

  if (anchor && anchor.text.trim()) {
    let html = renderMarkdownToHtml(anchor.text);
    html = autoLinkPatternIds(html, knownIds);
    sections.push({
      heading: 'Content',
      role: anchor.role ?? 'other',
      html,
    });
  }

  // Also include child sections
  if (indexNode) {
    for (const childId of indexNode.childIds) {
      const childNode = snapshot.indexMap[childId];
      if (!childNode) continue;
      const childAnchor =
        snapshot.anchorMap[childNode.anchorId || childNode.id];
      if (!childAnchor || !childAnchor.text.trim()) continue;
      let html = renderMarkdownToHtml(childAnchor.text);
      html = autoLinkPatternIds(html, knownIds);
      sections.push({
        heading: cleanSectionHeading(childNode.title),
        role: childNode.metadata?.role ?? 'other',
        html,
      });
    }
  }

  return {
    id: nodeId,
    title: indexNode?.title ?? anchor?.heading ?? nodeId,
    sections,
    keywords: [],
    aliases: [],
    relations: [],
  };
}

function buildSearchIndex(snapshot: Snapshot): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const [id, pattern] of Object.entries(snapshot.patternGraph.nodes)) {
    entries.push({
      id,
      title: pattern.title,
      keywords: pattern.keywords,
      aliases: pattern.aliases,
      part: pattern.part,
      status: pattern.status,
    });
  }
  return entries;
}

function buildRoutesData(
  snapshot: Snapshot,
): RoutePage[] {
  const pages: RoutePage[] = [];
  for (const route of Object.values(snapshot.routeGraph.nodes)) {
    const steps: RoutePageStep[] = [];
    for (const stepId of route.orderedIds) {
      const pattern = snapshot.patternGraph.nodes[stepId];
      steps.push({
        id: stepId,
        title: pattern?.title ?? stepId,
      });
    }
    pages.push({
      id: route.id,
      name: route.name,
      description: route.description,
      steps,
    });
  }
  return pages;
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
}

function findIndexNodeForPattern(
  patternId: string,
  indexMap: Record<string, IndexMapNode>,
): IndexMapNode | undefined {
  // Pattern IDs like "A.1" may be used directly as indexMap keys
  if (indexMap[patternId]) return indexMap[patternId];
  // Search by metadata.patternId
  return Object.values(indexMap).find(
    (n) => n.metadata?.patternId === patternId,
  );
}

function cleanTitle(title: string): string {
  return title
    .replace(/^\*+|\*+$/g, '')
    .replace(/^#+\s*/, '')
    .trim();
}

function cleanSectionHeading(title: string): string {
  return title
    .replace(/^\*+|\*+$/g, '')
    .replace(/^[A-Z]\.\d+(?:\.\d+)*(?::[A-Za-z0-9.]+)?\s*-\s*/, '')
    .replace(/^\d+\s*[-–—]\s*/, '')
    .trim();
}

function isTableOrMetaRoot(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.startsWith('| ') ||
    lower.includes('table of content') ||
    lower.startsWith('first principles framework')
  );
}

export async function buildWiki(): Promise<void> {
  console.log('Building FPF wiki…');
  const snapshot = await loadOrBuildSnapshot();
  const knownIds = collectKnownIds(snapshot.patternGraph.nodes);

  console.log('Building tree data…');
  const tree = buildTreeData(snapshot);

  console.log('Building search index…');
  const search = buildSearchIndex(snapshot);

  console.log('Building routes…');
  const routes = buildRoutesData(snapshot);

  console.log('Writing tree.json, search.json, routes.json…');
  await Promise.all([
    writeJson(resolve(OUTPUT_DIR, 'data/tree.json'), tree),
    writeJson(resolve(OUTPUT_DIR, 'data/search.json'), search),
    writeJson(resolve(OUTPUT_DIR, 'data/routes.json'), routes),
  ]);

  // Build pattern pages
  const patternIds = Object.keys(snapshot.patternGraph.nodes);
  console.log(`Building ${patternIds.length} pattern pages…`);
  const patternsDir = resolve(OUTPUT_DIR, 'data/patterns');
  await mkdir(patternsDir, { recursive: true });

  await Promise.all(patternIds.map(async (pid) => {
    const page = buildPatternPage(pid, snapshot, knownIds);
    await writeJson(resolve(patternsDir, `${sanitizeFilename(pid)}.json`), page);
  }));

  // Build preface pages (non-pattern leaf nodes from tree)
  await Promise.all(tree.flatMap((group) =>
    group.children
      .filter((child) => !child.patternId)
      .map(async (child) => {
        const page = buildPrefacePage(child.id, snapshot, knownIds);
        await writeJson(
          resolve(patternsDir, `${sanitizeFilename(child.id)}.json`),
          page,
        );
      }),
  ));

  console.log('Writing index.html…');
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(resolve(OUTPUT_DIR, 'index.html'), generateAppShell());

  const patternCount = patternIds.length;
  const treeGroupCount = tree.length;
  console.log(
    `Wiki built: ${patternCount} patterns, ${treeGroupCount} tree groups → ${OUTPUT_DIR}`,
  );
}

function sanitizeFilename(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_');
}

buildWiki().catch((err: unknown) => {
  console.error('Wiki build failed:', err);
  process.exit(1);
});
