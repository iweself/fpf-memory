import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { compileFpfSource } from '../src/runtime/compiler.js';
import type { IndexMapNode, PatternRecord, RouteRecord, Snapshot } from '../src/runtime/types.js';

const SOURCE_PATH = resolve(process.cwd(), 'FPF-spec.md');
const ARTIFACT_DIR = resolve(process.cwd(), '.runtime/fpf-index');
const SNAPSHOT_PATH = resolve(ARTIFACT_DIR, 'snapshot.json');
const GENERATED_ROOT = resolve(process.cwd(), 'docs/generated');
const PATTERNS_ROOT = resolve(GENERATED_ROOT, 'patterns');
const ROUTES_ROOT = resolve(GENERATED_ROOT, 'routes');
const PREFACE_ROOT = resolve(GENERATED_ROOT, 'preface');

interface TreeNode {
  id: string;
  title: string;
  patternId?: string;
  indexId?: string;
  status?: string;
  children: TreeNode[];
}

async function persistSnapshot(snapshot: Snapshot): Promise<void> {
  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot));
}

async function loadOrBuildSnapshot(): Promise<Snapshot> {
  const sourceText = await readFile(SOURCE_PATH, 'utf8');
  const sourceHash = `sha256:${createHash('sha256').update(sourceText).digest('hex')}`;

  try {
    const existing = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as Snapshot;
    if (existing.sourceHash === sourceHash) {
      console.log('Using existing snapshot (hash matches).');
      return existing;
    }
  } catch {
    // Fall through to rebuild.
  }

  console.log('Compiling snapshot for docs generation.');
  const { snapshot } = compileFpfSource({
    sourcePath: SOURCE_PATH,
    sourceHash,
    builtAt: new Date().toISOString(),
    sourceText,
  });
  await persistSnapshot(snapshot);
  return snapshot;
}

function buildTreeData(snapshot: Snapshot): TreeNode[] {
  const groups: TreeNode[] = [];

  for (const rootId of snapshot.indexRoots) {
    const rootNode = snapshot.indexMap[rootId];
    if (!rootNode) {
      continue;
    }

    const title = cleanTitle(rootNode.title);
    if (isTableOrMetaRoot(title)) {
      continue;
    }

    const children: TreeNode[] = [];
    collectPatternChildren(rootNode, snapshot.indexMap, snapshot.patternGraph.nodes, children);

    if (children.length === 0 && !rootNode.metadata?.patternId) {
      for (const childId of rootNode.childIds) {
        const child = snapshot.indexMap[childId];
        if (!child) {
          continue;
        }
        children.push({
          id: child.anchorId || child.id,
          indexId: child.id,
          title: cleanTitle(child.title),
          patternId: child.metadata?.patternId,
          status: child.metadata?.patternId
            ? snapshot.patternGraph.nodes[child.metadata.patternId]?.status
            : undefined,
          children: [],
        });
      }
    }

    if (children.length > 0) {
      groups.push({
        id: rootId,
        title,
        children,
      });
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
    if (!child) {
      continue;
    }

    if (child.metadata?.patternId) {
      out.push({
        id: child.metadata.patternId,
        title: cleanTitle(child.title),
        patternId: child.metadata.patternId,
        status: patternNodes[child.metadata.patternId]?.status,
        children: [],
      });
      continue;
    }

    if (child.level <= 2) {
      collectPatternChildren(child, indexMap, patternNodes, out);
    }
  }
}

function findIndexNodeForPattern(
  patternId: string,
  indexMap: Record<string, IndexMapNode>,
): IndexMapNode | undefined {
  return indexMap[patternId] ?? Object.values(indexMap).find((node) => node.metadata?.patternId === patternId);
}

function cleanTitle(title: string): string {
  return title.replace(/^\*+|\*+$/g, '').replace(/^#+\s*/, '').trim();
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

function sanitizeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function patternLink(id: string): string {
  return `/generated/patterns/${sanitizeFilename(id)}`;
}

function routeLink(id: string): string {
  return `/generated/routes/${sanitizeFilename(id)}`;
}

function prefaceLink(id: string): string {
  return `/generated/preface/${sanitizeFilename(id)}`;
}

function frontmatter(fields: Record<string, string | boolean | undefined>): string {
  const lines = ['---'];

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'undefined') {
      continue;
    }
    lines.push(typeof value === 'string' ? `${key}: ${JSON.stringify(value)}` : `${key}: ${value}`);
  }

  lines.push('---', '');
  return lines.join('\n');
}

function renderMetadataList(items: Array<[string, string | undefined]>): string {
  const visible = items.filter(([, value]) => value);
  if (visible.length === 0) {
    return '';
  }

  return visible.map(([label, value]) => `- **${label}:** ${value}`).join('\n');
}

function renderPatternPage(patternId: string, snapshot: Snapshot): string {
  const pattern = snapshot.patternGraph.nodes[patternId];
  const indexNode = findIndexNodeForPattern(patternId, snapshot.indexMap);
  const sections: Array<{ heading: string; body: string }> = [];

  if (indexNode) {
    const anchor = snapshot.anchorMap[indexNode.anchorId || indexNode.id];
    if (anchor?.text.trim()) {
      sections.push({ heading: 'Content', body: anchor.text.trim() });
    }

    for (const childId of indexNode.childIds) {
      const childNode = snapshot.indexMap[childId];
      if (!childNode) {
        continue;
      }

      const childAnchor = snapshot.anchorMap[childNode.anchorId || childNode.id];
      if (!childAnchor?.text.trim()) {
        continue;
      }

      sections.push({
        heading: cleanSectionHeading(childNode.title),
        body: childAnchor.text.trim(),
      });
    }
  }

  const relations = snapshot.relationGraph.filter(
    (edge) =>
      (edge.from === patternId || edge.to === patternId) &&
      !edge.relation.startsWith('outline_'),
  );

  const metadata = renderMetadataList([
    ['ID', patternId],
    ['Status', pattern?.status],
    ['Part', pattern?.part],
    ['Cluster', pattern?.cluster],
    ['Type', pattern?.type],
    ['Normativity', pattern?.normativity],
  ]);

  const aliases =
    pattern?.aliases.length
      ? `## Aliases\n\n${pattern.aliases.map((alias) => `- ${alias}`).join('\n')}\n`
      : '';
  const keywords =
    pattern?.keywords.length
      ? `## Keywords\n\n${pattern.keywords.map((keyword) => `- ${keyword}`).join('\n')}\n`
      : '';
  const relationBlock =
    relations.length > 0
      ? `## Relations\n\n${relations
          .map((edge) => {
            const otherId = edge.from === patternId ? edge.to : edge.from;
            const otherLabel = snapshot.patternGraph.nodes[otherId]?.title ?? otherId;
            const link = snapshot.patternGraph.nodes[otherId] ? patternLink(otherId) : null;
            return `- \`${edge.from}\` --${edge.relation}--> ${
              link ? `[${otherLabel}](${link})` : `\`${otherLabel}\``
            }`;
          })
          .join('\n')}\n`
      : '';

  const sectionBlocks = sections
    .map((section) => `## ${section.heading}\n\n${section.body}\n`)
    .join('\n');

  return [
    frontmatter({
      title: pattern?.title ?? indexNode?.title ?? patternId,
      description: pattern?.part ?? pattern?.cluster ?? `Reference page for ${patternId}.`,
    }),
    `# ${pattern?.title ?? indexNode?.title ?? patternId}`,
    '',
    metadata,
    '',
    aliases,
    keywords,
    relationBlock,
    sectionBlocks,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderRoutePage(route: RouteRecord, snapshot: Snapshot): string {
  const steps = route.orderedIds
    .map((stepId) => {
      const pattern = snapshot.patternGraph.nodes[stepId];
      return `1. [${pattern?.title ?? stepId}](${patternLink(stepId)})`;
    })
    .join('\n');

  return [
    frontmatter({
      title: route.name,
      description: route.description,
    }),
    `# ${route.name}`,
    '',
    `- **Route ID:** \`${route.id}\``,
    '',
    route.description,
    '',
    '## Ordered steps',
    '',
    steps,
    '',
  ].join('\n');
}

function renderPrefacePage(nodeId: string, snapshot: Snapshot, indexId?: string): string {
  const anchor = snapshot.anchorMap[nodeId];
  const indexNode = snapshot.indexMap[indexId ?? nodeId] ?? snapshot.indexMap[nodeId];
  const sections: string[] = [];

  if (anchor?.text.trim()) {
    sections.push(`## Content\n\n${anchor.text.trim()}\n`);
  }

  if (indexNode) {
    for (const childId of indexNode.childIds) {
      const childNode = snapshot.indexMap[childId];
      if (!childNode) {
        continue;
      }

      const childAnchor = snapshot.anchorMap[childNode.anchorId || childNode.id];
      if (!childAnchor?.text.trim()) {
        continue;
      }

      sections.push(`## ${cleanSectionHeading(childNode.title)}\n\n${childAnchor.text.trim()}\n`);
    }
  }

  const title = cleanTitle(indexNode?.title ?? anchor?.heading ?? nodeId);

  return [
    frontmatter({
      title,
      description: `Generated reference page for ${nodeId}.`,
    }),
    `# ${title}`,
    '',
    `- **Node ID:** \`${nodeId}\``,
    '',
    sections.join('\n'),
  ].join('\n');
}

function renderPatternsIndex(patterns: PatternRecord[]): string {
  const grouped = new Map<string, PatternRecord[]>();

  for (const pattern of patterns) {
    const key = pattern.part ?? 'Unscoped';
    grouped.set(key, [...(grouped.get(key) ?? []), pattern]);
  }

  const sections = Array.from(grouped.entries()).map(
    ([group, entries]) =>
      `## ${group}\n\n${entries
        .map((pattern) => `- [${pattern.id} - ${pattern.title}](${patternLink(pattern.id)})`)
        .join('\n')}\n`,
  );

  return [
    frontmatter({
      title: 'Pattern Catalog',
      description: 'Generated pattern pages from the compiler snapshot.',
    }),
    '# Pattern Catalog',
    '',
    `Generated pages: ${patterns.length}`,
    '',
    ...sections,
  ].join('\n');
}

function renderRoutesIndex(routes: RouteRecord[]): string {
  return [
    frontmatter({
      title: 'Route Catalog',
      description: 'Generated route pages from the compiler snapshot.',
    }),
    '# Route Catalog',
    '',
    `Generated pages: ${routes.length}`,
    '',
    ...routes.map(
      (route) =>
        `## [${route.name}](${routeLink(route.id)})\n\n- **Route ID:** \`${route.id}\`\n- **Steps:** ${route.orderedIds.length}\n\n${route.description}\n`,
    ),
  ].join('\n');
}

function renderPrefaceIndex(groups: TreeNode[]): string {
  const sections = groups
    .map((group) => {
      const items = group.children
        .filter((child) => !child.patternId)
        .map((child) => `- [${child.title}](${prefaceLink(child.id)})`);
      if (items.length === 0) {
        return '';
      }

      return `## ${group.title}\n\n${items.join('\n')}\n`;
    })
    .filter(Boolean);

  return [
    frontmatter({
      title: 'Preface Catalog',
      description: 'Generated non-pattern reference pages from the compiler snapshot.',
    }),
    '# Preface Catalog',
    '',
    ...sections,
  ].join('\n');
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function buildDocs(): Promise<void> {
  console.log('Generating Rspress content from compiler snapshot.');
  const snapshot = await loadOrBuildSnapshot();
  const tree = buildTreeData(snapshot);
  const patterns = Object.values(snapshot.patternGraph.nodes);
  const routes = Object.values(snapshot.routeGraph.nodes);

  await rm(GENERATED_ROOT, { recursive: true, force: true });
  await Promise.all([
    mkdir(PATTERNS_ROOT, { recursive: true }),
    mkdir(ROUTES_ROOT, { recursive: true }),
    mkdir(PREFACE_ROOT, { recursive: true }),
  ]);

  await writeText(resolve(PATTERNS_ROOT, 'index.md'), renderPatternsIndex(patterns));
  await writeText(resolve(ROUTES_ROOT, 'index.md'), renderRoutesIndex(routes));
  await writeText(resolve(PREFACE_ROOT, 'index.md'), renderPrefaceIndex(tree));

  await Promise.all(
    patterns.map((pattern) =>
      writeText(
        resolve(PATTERNS_ROOT, `${sanitizeFilename(pattern.id)}.md`),
        renderPatternPage(pattern.id, snapshot),
      ),
    ),
  );

  await Promise.all(
    routes.map((route) =>
      writeText(
        resolve(ROUTES_ROOT, `${sanitizeFilename(route.id)}.md`),
        renderRoutePage(route, snapshot),
      ),
    ),
  );

  await Promise.all(
    tree.flatMap((group) =>
      group.children
        .filter((child) => !child.patternId)
        .map((child) =>
          writeText(
            resolve(PREFACE_ROOT, `${sanitizeFilename(child.id)}.md`),
            renderPrefacePage(child.id, snapshot, child.indexId),
          ),
        ),
    ),
  );

  console.log(
    `Docs generated: ${patterns.length} patterns, ${routes.length} routes, ${tree.flatMap((group) => group.children).filter((child) => !child.patternId).length} preface pages.`,
  );
}

buildDocs().catch((error) => {
  console.error('Docs generation failed:', error);
  process.exit(1);
});
