import {
  PART_C_CLUSTER_LABELS,
  PREFACE_MARKER,
  PREFACE_ROUTE_CITATION,
} from './constants.js';
import {
  cleanMarkdown,
  extractIds,
  isMarkdownSeparatorRow,
  normalizeForLookup,
  normalizeLabel,
  slugify,
  splitMarkdownRow,
  stripMarkdownToText,
  unique,
} from './text.js';
import type { AnchorRef, RelationEdge, RelationKind, SectionRole } from './types.js';

export interface HeadingSection extends AnchorRef {
  level: number;
  fullId?: string;
  patternId?: string;
  parentId?: string;
  childIds: string[];
}

export interface PatternMeta {
  id: string;
  title: string;
  status: string;
  description?: string;
  keywords: string[];
  queries: string[];
  dependenciesRaw: string;
  part?: string;
  cluster?: string;
  relations: RelationEdge[];
}

export interface CatalogDescription {
  title: string;
  description: string;
}

export interface SourceIR {
  lines: string[];
  catalogLines: string[];
  sections: HeadingSection[];
  metadata: Record<string, PatternMeta>;
  catalogDescriptions: Record<string, CatalogDescription>;
  anchorMap: Record<string, AnchorRef>;
}

const RELATION_LABELS: Record<string, RelationKind> = {
  'builds on': 'builds_on',
  'prerequisite for': 'prerequisite_for',
  'used by': 'used_by',
  'coordinates with': 'coordinates_with',
  constrains: 'constrains',
  refines: 'refines',
  enables: 'enables',
  informs: 'informs',
  constitutes: 'constitutes',
  'constrained by': 'constrained_by',
  'interacts with': 'interacts_with',
};

const PATTERN_ROW_ID = /^\**[A-Z]\.\d+(?:\.[A-Za-z0-9]+)*\**$/;
const HEADING_ID =
  /^([A-Z]\.\d+(?:\.[A-Za-z0-9]+)*(?::[A-Za-z0-9.]+)?)\s+-\s+(.+)$/;

export function parseSource(sourceText: string): SourceIR {
  const lines = sourceText.split(/\r?\n/);
  const prefaceIndex = lines.findIndex((line) => line.trim() === PREFACE_MARKER);
  const catalogLines = prefaceIndex >= 0 ? lines.slice(0, prefaceIndex) : lines;

  const metadata = parseCatalogMetadata(catalogLines);
  const catalogDescriptions = parseCatalogDescriptions(catalogLines);
  const sections = parseHeadingSections(lines);
  const anchorMap = buildAnchorMap(lines, sections);

  return { lines, catalogLines, sections, metadata, catalogDescriptions, anchorMap };
}

function parseHeadingSections(lines: string[]): HeadingSection[] {
  const headings: Array<{
    lineIndex: number;
    level: number;
    title: string;
    fullId?: string;
    patternId?: string;
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (!match) {
      continue;
    }
    const level = match[1].length;
    const title = cleanMarkdown(match[2]);
    const idMatch = title.match(HEADING_ID);
    const fullId = idMatch?.[1];
    const patternId = fullId ? fullId.split(':')[0] : undefined;
    headings.push({
      lineIndex: index,
      level,
      title,
      fullId,
      patternId,
    });
  }

  const sections: HeadingSection[] = [];
  const stack: HeadingSection[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index]!;
    const next = headings[index + 1];
    const lineStart = current.lineIndex + 1;
    const lineEnd = next ? next.lineIndex : lines.length;
    const rawBody = lines.slice(current.lineIndex + 1, lineEnd).join('\n').trimEnd();
    const id = current.fullId
      ? current.fullId
      : `heading:${slugify(current.title)}:${lineStart}`;

    while (stack.length > 0 && stack.at(-1)!.level >= current.level) {
      stack.pop();
    }

    const path = [...stack.map((item) => item.heading), current.title];
    const parentId = stack.at(-1)?.id;
    const section: HeadingSection = {
      id,
      nodeId: current.patternId,
      heading: current.title,
      lineStart,
      lineEnd,
      path,
      text: rawBody,
      plainText: stripMarkdownToText(rawBody),
      role: inferSectionRole(current.title, current.fullId),
      level: current.level,
      fullId: current.fullId,
      patternId: current.patternId,
      parentId,
      childIds: [],
    };
    const parentSection = stack.at(-1);
    if (parentSection) {
      parentSection.childIds.push(id);
    }
    sections.push(section);
    stack.push(section);
  }

  return sections;
}

function buildAnchorMap(
  lines: string[],
  sections: HeadingSection[],
): Record<string, AnchorRef> {
  const anchorMap: Record<string, AnchorRef> = {};
  for (const section of sections) {
    anchorMap[section.id] = {
      id: section.id,
      nodeId: section.patternId,
      heading: section.heading,
      lineStart: section.lineStart,
      lineEnd: section.lineEnd,
      path: section.path,
      text: section.text,
      plainText: section.plainText,
      role: section.role,
    };
  }

  const prefaceRouteAnchor = buildSyntheticAnchor(
    lines,
    '**Where to start**',
    'Everything in the Core',
    PREFACE_ROUTE_CITATION,
    ['Preface', 'Where to start'],
    'Where to start',
    'route_surface',
  );
  if (prefaceRouteAnchor) {
    anchorMap[prefaceRouteAnchor.id] = prefaceRouteAnchor;
  }

  return anchorMap;
}

function buildSyntheticAnchor(
  lines: string[],
  startMarker: string,
  endMarker: string,
  id: string,
  path: string[],
  heading: string,
  role: SectionRole,
): AnchorRef | undefined {
  const startIndex = lines.findIndex((line) => line.includes(startMarker));
  if (startIndex < 0) {
    return undefined;
  }
  let endIndex = lines.findIndex((line, index) => index > startIndex && line.includes(endMarker));
  if (endIndex < 0) {
    endIndex = lines.length;
  }
  const text = lines.slice(startIndex, endIndex).join('\n').trimEnd();
  return {
    id,
    heading,
    lineStart: startIndex + 1,
    lineEnd: endIndex,
    path,
    text,
    plainText: stripMarkdownToText(text),
    role,
  };
}

function parseCatalogDescriptions(lines: string[]): Record<string, CatalogDescription> {
  const descriptions: Record<string, CatalogDescription> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      continue;
    }

    const cells = splitMarkdownRow(trimmed);
    if (cells.length < 3 || isMarkdownSeparatorRow(cells)) {
      continue;
    }

    const firstCell = normalizeLabel((cells[0] ?? '').replace(/\*/g, ''));
    const secondCell = normalizeLabel(cells[1] ?? '');
    const thirdCell = normalizeLabel(cells[2] ?? '');
    if (!firstCell || !secondCell || !thirdCell) {
      continue;
    }

    if (PATTERN_ROW_ID.test(firstCell) || normalizeForLookup(firstCell) === 'id & title') {
      continue;
    }

    descriptions[normalizeForLookup(firstCell)] = {
      title: firstCell,
      description: thirdCell,
    };
    descriptions[normalizeForLookup(secondCell)] = {
      title: secondCell,
      description: thirdCell,
    };
  }
  return descriptions;
}

function parseCatalogMetadata(lines: string[]): Record<string, PatternMeta> {
  const metadata: Record<string, PatternMeta> = {};
  let currentPart: string | undefined;
  let currentCluster: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      const partMatch = trimmed.match(/^\*\*Part\s+([A-Z])\s*[–—-]\s*(.+)\*\*$/);
      if (partMatch) {
        currentPart = normalizeLabel(`Part ${partMatch[1]} - ${partMatch[2]}`);
        currentCluster = undefined;
      }
      continue;
    }

    const cells = splitMarkdownRow(trimmed);
    if (cells.length < 3 || isMarkdownSeparatorRow(cells)) {
      continue;
    }

    const firstCell = normalizeLabel((cells[0] ?? '').replace(/\*/g, ''));
    if (firstCell.includes('Cluster C.')) {
      currentCluster = normalizeClusterLabel(firstCell);
      continue;
    }

    if (!PATTERN_ROW_ID.test(firstCell)) {
      continue;
    }

    const title = cleanMarkdown(cells[1] ?? '');
    const status = normalizeLabel(cells[2] ?? '');
    const keywordsCell = cleanMarkdown(cells[3] ?? '');
    const dependenciesRaw = cleanMarkdown(cells[4] ?? '');
    const description =
      !dependenciesRaw &&
      keywordsCell &&
      !/\*keywords:\*|\*queries:\*/i.test(keywordsCell)
        ? keywordsCell
        : undefined;

    metadata[firstCell] = {
      id: firstCell,
      title,
      status,
      description,
      keywords: parseKeywords(keywordsCell),
      queries: parseQueries(keywordsCell),
      dependenciesRaw,
      part: currentPart,
      cluster: currentCluster,
      relations: parseLabeledRelations(firstCell, dependenciesRaw, `${firstCell}:catalog`),
    };
  }

  return metadata;
}

export function parseHeadingMetadata(
  lines: string[],
  startLine: number,
  endLine: number,
): { type?: string; status?: string; normativity?: string } {
  const result: { type?: string; status?: string; normativity?: string } = {};
  for (let index = startLine - 1; index < endLine; index += 1) {
    const line = lines[index]?.trim();
    if (!line?.startsWith('>')) {
      if (line && !line.startsWith('*') && !line.startsWith('>')) {
        break;
      }
      continue;
    }
    const cleanLine = cleanMarkdown(line.replace(/^>\s*/, ''));
    const match = cleanLine.match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const key = normalizeForLookup(match[1] ?? '');
    if (key === 'type') {
      result.type = match[2];
    } else if (key === 'status') {
      result.status = match[2];
    } else if (key === 'normativity') {
      result.normativity = match[2];
    }
  }
  return result;
}

export function parseRelationSection(section?: HeadingSection): RelationEdge[] {
  if (!section) {
    return [];
  }
  return parseLabeledRelations(section.patternId ?? section.id, section.text, section.id);
}

export function parseLabeledRelations(
  sourceId: string,
  text: string,
  sourceCitation: string,
): RelationEdge[] {
  const relationEdges: RelationEdge[] = [];
  const relationRegex =
    /\*\*([^:*]+):\*\*\s*([\s\S]*?)(?=(?:\n\s*[*-]\s*\*\*[^:*]+:\*\*|\s+\*\*[^:*]+:\*\*|$))/g;
  for (const match of text.matchAll(relationRegex)) {
    const label = normalizeForLookup(match[1] ?? '');
    const relation = RELATION_LABELS[label];
    if (!relation) {
      continue;
    }
    for (const target of extractIds(match[2] ?? '')) {
      relationEdges.push({
        from: sourceId,
        relation,
        to: target,
        source: sourceCitation,
      });
    }
  }
  return relationEdges;
}

export function inferSectionRole(heading: string, fullId?: string): SectionRole {
  const normalized = normalizeForLookup(`${fullId ?? ''} ${heading}`);
  if (normalized.includes('definition')) {
    return 'definition';
  }
  if (normalized.includes('solution')) {
    return 'solution';
  }
  if (normalized.includes('relations')) {
    return 'relations';
  }
  if (normalized.includes('conformance')) {
    return 'conformance';
  }
  if (normalized.includes('problem')) {
    return 'problem';
  }
  if (normalized.includes('forces')) {
    return 'forces';
  }
  return 'other';
}

function parseKeywords(cell: string): string[] {
  const match = cell.match(/Keywords:\s*(.+?)(?:Queries:|$)/i);
  if (!match) {
    return [];
  }
  return match[1]!
    .split(',')
    .map((entry) => normalizeLabel(entry))
    .filter(Boolean);
}

function parseQueries(cell: string): string[] {
  const match = cell.match(/Queries:\s*(.+)$/i);
  if (!match) {
    return [];
  }
  return Array.from(match[1]!.matchAll(/"([^"]+)"/g), (item) => normalizeLabel(item[1] ?? ''))
    .filter(Boolean);
}

function normalizeClusterLabel(label: string): string {
  const normalized = normalizeLabel(label);
  const matched = PART_C_CLUSTER_LABELS.find(
    (candidate) => normalizeForLookup(candidate) === normalizeForLookup(normalized),
  );
  return matched ?? normalized;
}


export function deriveAliases(title: string, rawHeading: string): string[] {
  const aliases = new Set<string>([title]);
  const prefix = primarySymbolFromTitle(title);
  if (prefix) {
    aliases.add(prefix);
  }
  for (const source of [title, rawHeading]) {
    for (const match of source.matchAll(/`([^`]+)`/g)) {
      aliases.add(match[1]!);
    }
  }
  return unique(aliases);
}

export function primarySymbolFromTitle(title: string): string | undefined {
  const colonPrefix = title.split(':')[0]?.trim();
  if (colonPrefix && /[A-Z]\.[A-Za-z]/.test(colonPrefix)) {
    return colonPrefix;
  }
  const dashPrefix = title.split(' - ')[0]?.trim();
  if (dashPrefix && /[A-Z]\.[A-Za-z]/.test(dashPrefix)) {
    return dashPrefix;
  }
  return undefined;
}

export function derivePrefaceRouteName(line: string): string | undefined {
  const boldMatches = Array.from(line.matchAll(/\*\*([^*]+)\*\*/g), (match) => match[1]!);
  if (boldMatches.length > 0) {
    return normalizeLabel(boldMatches[0]!);
  }
  const afterPrefix = line.replace(/^- /, '');
  const separatorIndex = afterPrefix.indexOf(':');
  if (separatorIndex < 0) {
    return undefined;
  }
  const candidate = afterPrefix
    .slice(0, separatorIndex)
    .replace(/^For\s+/i, '')
    .replace(/^When\s+/i, '');
  return normalizeLabel(candidate);
}

export function extractOrderedIds(line: string): string[] {
  const startWithIndex = line.indexOf('start with');
  if (startWithIndex < 0) {
    return [];
  }
  const endIndex = line.indexOf('Land on');
  const segment = line.slice(startWithIndex, endIndex > 0 ? endIndex : undefined);
  return extractIds(segment);
}

export function extractLandingIds(line: string): string[] {
  const landingIndex = line.indexOf('Land on');
  if (landingIndex < 0) {
    return [];
  }
  return extractIds(line.slice(landingIndex));
}

export function routeKey(name: string): string {
  return `route:${slugify(name)}`;
}

// Re-export helpers needed by downstream modules
export {
  cleanMarkdown,
  extractIds,
  normalizeForLookup,
  normalizeLabel,
  slugify,
} from './text.js';
