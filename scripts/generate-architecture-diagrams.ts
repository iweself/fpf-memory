import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type ColorName =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'cloud'
  | 'security'
  | 'messageBus'
  | 'generic';

type CardSpec = {
  dot: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose';
  title: string;
  items: string[];
};

type DiagramPage = {
  fileName: string;
  title: string;
  subtitle: string;
  footer: string;
  viewBox: string;
  svg: string;
  cards: [CardSpec, CardSpec, CardSpec];
};

const palette: Record<ColorName, { fill: string; stroke: string }> = {
  frontend: { fill: 'rgba(8, 51, 68, 0.4)', stroke: '#22d3ee' },
  backend: { fill: 'rgba(6, 78, 59, 0.4)', stroke: '#34d399' },
  database: { fill: 'rgba(76, 29, 149, 0.4)', stroke: '#a78bfa' },
  cloud: { fill: 'rgba(120, 53, 15, 0.3)', stroke: '#fbbf24' },
  security: { fill: 'rgba(136, 19, 55, 0.4)', stroke: '#fb7185' },
  messageBus: { fill: 'rgba(251, 146, 60, 0.3)', stroke: '#fb923c' },
  generic: { fill: 'rgba(30, 41, 59, 0.5)', stroke: '#94a3b8' },
};

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function box(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: ColorName;
  title: string;
  lines?: string[];
  tiny?: string[];
  center?: boolean;
}): string {
  const { x, y, width, height, color, title, lines = [], tiny = [], center = true } = params;
  const style = palette[color];
  const centerX = x + width / 2;
  const textAnchor = center ? 'middle' : 'start';
  const textX = center ? centerX : x + 14;
  const titleY = y + 26;
  const lineNodes: string[] = [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="#0f172a"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`,
    `<text x="${textX}" y="${titleY}" fill="white" font-size="12" font-weight="600" text-anchor="${textAnchor}">${esc(title)}</text>`,
  ];
  lines.forEach((line, index) => {
    lineNodes.push(
      `<text x="${textX}" y="${y + 44 + index * 14}" fill="#94a3b8" font-size="9" text-anchor="${textAnchor}">${esc(line)}</text>`,
    );
  });
  tiny.forEach((line, index) => {
    lineNodes.push(
      `<text x="${textX}" y="${y + 44 + lines.length * 14 + index * 12}" fill="${style.stroke}" font-size="7" text-anchor="${textAnchor}">${esc(line)}</text>`,
    );
  });
  return `<g>\n${lineNodes.join('\n')}\n</g>`;
}

function boundary(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: 'cloud' | 'security' | 'generic';
}): string {
  const style = palette[params.color];
  return `
<rect x="${params.x}" y="${params.y}" width="${params.width}" height="${params.height}" rx="12" fill="transparent" stroke="${style.stroke}" stroke-width="1" stroke-dasharray="${params.color === 'cloud' ? '8,4' : '4,4'}"/>
<text x="${params.x + 12}" y="${params.y + 18}" fill="${style.stroke}" font-size="10" font-weight="600">${esc(params.label)}</text>`;
}

function arrow(params: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  label?: string;
  labelX?: number;
  labelY?: number;
  dashed?: boolean;
}): string {
  const color = params.color ?? '#64748b';
  return `
<line x1="${params.x1}" y1="${params.y1}" x2="${params.x2}" y2="${params.y2}" stroke="${color}" stroke-width="1.6" ${params.dashed ? 'stroke-dasharray="5,5"' : ''} marker-end="url(#arrowhead)"/>
${params.label ? `<text x="${params.labelX ?? (params.x1 + params.x2) / 2}" y="${params.labelY ?? (params.y1 + params.y2) / 2 - 6}" fill="${params.dashed ? '#fb7185' : '#94a3b8'}" font-size="8" text-anchor="middle">${esc(params.label)}</text>` : ''}`.trim();
}

function pathArrow(params: {
  d: string;
  color?: string;
  dashed?: boolean;
  label?: string;
  labelX?: number;
  labelY?: number;
}): string {
  const color = params.color ?? '#64748b';
  return `
<path d="${params.d}" fill="none" stroke="${color}" stroke-width="1.6" ${params.dashed ? 'stroke-dasharray="5,5"' : ''} marker-end="url(#arrowhead)"/>
${params.label ? `<text x="${params.labelX ?? 0}" y="${params.labelY ?? 0}" fill="${params.dashed ? '#fb7185' : '#94a3b8'}" font-size="8" text-anchor="middle">${esc(params.label)}</text>` : ''}`.trim();
}

function pageTemplate(page: DiagramPage): string {
  const cardsHtml = page.cards
    .map(
      (card) => `
      <div class="card">
        <div class="card-header">
          <div class="card-dot ${card.dot}"></div>
          <h3>${esc(card.title)}</h3>
        </div>
        <ul>
          ${card.items.map((item) => `<li>• ${esc(item)}</li>`).join('\n')}
        </ul>
      </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(page.title)} | FPF Architecture Diagram</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'JetBrains Mono', monospace;
      background: #020617;
      min-height: 100vh;
      padding: 2rem;
      color: white;
    }
    .container { max-width: 1280px; margin: 0 auto; }
    .header { margin-bottom: 2rem; }
    .header-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .pulse-dot { width: 12px; height: 12px; background: #22d3ee; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.025em; }
    .subtitle { color: #94a3b8; font-size: 0.875rem; margin-left: 1.75rem; line-height: 1.5; }
    .diagram-container {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 1rem;
      border: 1px solid #1e293b;
      padding: 1.5rem;
      overflow-x: auto;
    }
    svg { width: 100%; min-width: 960px; display: block; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .card {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 0.75rem;
      border: 1px solid #1e293b;
      padding: 1.25rem;
    }
    .card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .card-dot { width: 8px; height: 8px; border-radius: 50%; }
    .card-dot.cyan { background: #22d3ee; }
    .card-dot.emerald { background: #34d399; }
    .card-dot.violet { background: #a78bfa; }
    .card-dot.amber { background: #fbbf24; }
    .card-dot.rose { background: #fb7185; }
    .card h3 { font-size: 0.875rem; font-weight: 600; }
    .card ul { list-style: none; color: #94a3b8; font-size: 0.75rem; }
    .card li { margin-bottom: 0.375rem; line-height: 1.45; }
    .footer { text-align: center; margin-top: 1.5rem; color: #475569; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-row">
        <div class="pulse-dot"></div>
        <h1>${esc(page.title)}</h1>
      </div>
      <p class="subtitle">${esc(page.subtitle)}</p>
    </div>

    <div class="diagram-container">
      <svg viewBox="${page.viewBox}">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        ${page.svg}
      </svg>
    </div>

    <div class="cards">
      ${cardsHtml}
    </div>

    <div class="footer">${esc(page.footer)}</div>
  </div>
</body>
</html>`;
}

function packPanel(
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  mini: string,
): string {
  return `
  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="rgba(15,23,42,0.65)" stroke="#1e293b" stroke-width="1.2"/>
  <text x="${x + 16}" y="${y + 22}" fill="white" font-size="11" font-weight="700">${esc(title)}</text>
  <text x="${x + 16}" y="${y + 36}" fill="#94a3b8" font-size="8">${esc(subtitle)}</text>
  ${mini}`;
}

const pages: DiagramPage[] = [
  {
    fileName: 'fpf-runtime-bounded-context-map.html',
    title: 'FPF Memory | Bounded Context Map',
    subtitle:
      'Design-time context ownership view. One internal bridge, explicit runtime faces, explicit publication systems, and optional local synthesis.',
    viewBox: '0 0 1200 760',
    svg: [
      boundary({ x: 70, y: 70, width: 1060, height: 240, label: 'Internal Contexts', color: 'cloud' }),
      boundary({ x: 70, y: 360, width: 1060, height: 260, label: 'Runtime + Publication Contexts', color: 'cloud' }),
      arrow({ x1: 230, y1: 190, x2: 370, y2: 190, color: '#34d399', label: 'uses', labelX: 300, labelY: 182 }),
      arrow({ x1: 490, y1: 190, x2: 730, y2: 190, color: '#34d399', label: 'composition consumes app + infra', labelX: 615, labelY: 182 }),
      arrow({ x1: 860, y1: 190, x2: 930, y2: 190, color: '#fbbf24', label: 'bridge', labelX: 895, labelY: 182 }),
      arrow({ x1: 1080, y1: 190, x2: 1130, y2: 190, color: '#fb923c', label: 'optional', labelX: 1105, labelY: 182 }),
      arrow({ x1: 200, y1: 476, x2: 200, y2: 270, color: '#22d3ee', label: 'compose MCP', labelX: 240, labelY: 380 }),
      arrow({ x1: 410, y1: 476, x2: 410, y2: 270, color: '#22d3ee', label: 'compose hosted', labelX: 470, labelY: 380 }),
      arrow({ x1: 620, y1: 476, x2: 440, y2: 250, color: '#a78bfa', label: 'publish docs', labelX: 536, labelY: 340 }),
      arrow({ x1: 830, y1: 476, x2: 670, y2: 250, color: '#fbbf24', label: 'stage build', labelX: 770, labelY: 340 }),
      arrow({ x1: 1030, y1: 476, x2: 980, y2: 250, color: '#fb7185', label: 'compat uses bridge', labelX: 1075, labelY: 340 }),
      arrow({ x1: 250, y1: 476, x2: 360, y2: 476, color: '#fb7185', dashed: true, label: 'forbidden', labelX: 305, labelY: 468 }),
      box({ x: 90, y: 130, width: 140, height: 72, color: 'backend', title: 'Ctx.Core', lines: ['meaning + retrieval'] }),
      box({ x: 370, y: 130, width: 120, height: 72, color: 'backend', title: 'Ctx.App', lines: ['typed services'] }),
      box({ x: 730, y: 130, width: 130, height: 72, color: 'cloud', title: 'Ctx.Infra', lines: ['config + logs + obs'] }),
      box({ x: 930, y: 130, width: 150, height: 72, color: 'generic', title: 'Composition', lines: ['approved bridge'] }),
      box({ x: 1130, y: 120, width: 70, height: 92, color: 'messageBus', title: 'LLM', lines: ['optional', 'local synth'] }),
      box({ x: 120, y: 440, width: 130, height: 72, color: 'frontend', title: 'Ctx.Run.MCP', lines: ['tool face'] }),
      box({ x: 360, y: 440, width: 140, height: 72, color: 'frontend', title: 'Ctx.Run.Hosted', lines: ['hosted face'] }),
      box({ x: 560, y: 440, width: 120, height: 72, color: 'database', title: 'Ctx.Docs', lines: ['publication'] }),
      box({ x: 770, y: 440, width: 120, height: 72, color: 'cloud', title: 'Ctx.Build', lines: ['artifacts'] }),
      box({ x: 940, y: 420, width: 180, height: 92, color: 'security', title: 'Ctx.Compat', lines: ['bootstrap only'], tiny: ['Mastra exception'] }),
      `<text x="92" y="664" fill="#94a3b8" font-size="9">Design rule: Core/App/Infra stay internal; runtime faces and publication systems stay separate; local synthesis remains optional and bounded.</text>`,
    ].join('\n'),
    cards: [
      {
        dot: 'cyan',
        title: 'Viewpoint',
        items: [
          'Described entity: FPF memory runtime surface architecture',
          'Viewpoint: bounded-context ownership view',
          'Temporal mode: design-time description',
        ],
      },
      {
        dot: 'emerald',
        title: 'Reading Order',
        items: [
          'Start with internal contexts at the top.',
          'Treat Composition as the only approved bridge.',
          'Read runtime, publication, and compat surfaces below.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'A.1.1 bounded context ownership',
          'A.6 boundary layers and faces',
          'Optional LLM is a bounded mechanism, not a peer system',
        ],
      },
    ],
    footer: 'Generated as a standalone architecture diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-boundary-faces.html',
    title: 'FPF Memory | Boundary Faces',
    subtitle:
      'Publication/contract view. External faces project into one canonical runtime, while docs and build remain distinct publication faces.',
    viewBox: '0 0 1200 760',
    svg: [
      boundary({ x: 70, y: 80, width: 230, height: 350, label: 'External Faces', color: 'cloud' }),
      boundary({ x: 340, y: 110, width: 600, height: 320, label: 'Canonical Internal Runtime', color: 'generic' }),
      boundary({ x: 970, y: 360, width: 170, height: 170, label: 'Publication Faces', color: 'cloud' }),
      arrow({ x1: 210, y1: 170, x2: 400, y2: 240, color: '#22d3ee', label: 'map MCP request', labelX: 295, labelY: 194 }),
      arrow({ x1: 210, y1: 255, x2: 400, y2: 260, color: '#22d3ee', label: 'map CLI request', labelX: 296, labelY: 248 }),
      arrow({ x1: 210, y1: 340, x2: 400, y2: 280, color: '#22d3ee', label: 'map hosted boot', labelX: 290, labelY: 328 }),
      arrow({ x1: 530, y1: 258, x2: 610, y2: 258, color: '#34d399', label: 'invoke', labelX: 570, labelY: 250 }),
      arrow({ x1: 730, y1: 258, x2: 810, y2: 258, color: '#34d399', label: 'execute', labelX: 770, labelY: 250 }),
      arrow({ x1: 930, y1: 258, x2: 1015, y2: 258, color: '#fb923c', label: 'optional only', labelX: 972, labelY: 250 }),
      arrow({ x1: 700, y1: 310, x2: 1040, y2: 450, color: '#a78bfa', label: 'publish docs', labelX: 880, labelY: 364 }),
      arrow({ x1: 830, y1: 310, x2: 1080, y2: 500, color: '#fbbf24', label: 'stage build', labelX: 980, labelY: 404 }),
      box({ x: 90, y: 130, width: 120, height: 54, color: 'frontend', title: 'MCP Face', lines: ['tool ids + schemas'] }),
      box({ x: 90, y: 215, width: 120, height: 54, color: 'frontend', title: 'CLI Face', lines: ['flags + output'] }),
      box({ x: 90, y: 300, width: 120, height: 54, color: 'frontend', title: 'Hosted Face', lines: ['HTTP / Mastra'] }),
      box({ x: 400, y: 220, width: 130, height: 72, color: 'generic', title: 'Composition', lines: ['maps face → command'] }),
      box({ x: 610, y: 220, width: 120, height: 72, color: 'backend', title: 'App Services', lines: ['query + trace + inspect'] }),
      box({ x: 810, y: 220, width: 120, height: 72, color: 'backend', title: 'Runtime/Core', lines: ['deterministic retrieval'] }),
      box({ x: 1015, y: 220, width: 120, height: 72, color: 'messageBus', title: 'Local LLM', lines: ['optional synthesis'] }),
      box({ x: 990, y: 430, width: 140, height: 62, color: 'database', title: 'Docs Face', lines: ['generated publication'] }),
      box({ x: 990, y: 500, width: 140, height: 62, color: 'cloud', title: 'Build Face', lines: ['staged artifacts'] }),
      `<text x="72" y="640" fill="#94a3b8" font-size="9">Rule: a face is an external promise or publication surface. It must not become a second system model.</text>`,
    ].join('\n'),
    cards: [
      {
        dot: 'cyan',
        title: 'Viewpoint',
        items: [
          'Described entity: FPF memory runtime boundary surfaces',
          'Viewpoint: boundary projection / publication face view',
          'Temporal mode: design-time description',
        ],
      },
      {
        dot: 'rose',
        title: 'Face Discipline',
        items: [
          'MCP, CLI, hosted, docs, and build are the faces.',
          'The local LLM is not a face.',
          'Faces should not add new semantics beyond the underlying system.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'A.6 boundary discipline',
          'E.17 publication as epistemic viewing',
          'C.2.1 viewpoint-specific artifact',
        ],
      },
    ],
    footer: 'Generated as a standalone boundary-face diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-role-method-work-stack.html',
    title: 'FPF Memory | Role / Method / Work Stack',
    subtitle:
      'Separation view. Role, capability, method, plan, work, and evidence stay distinct and are not collapsed into one architecture story.',
    viewBox: '0 0 1200 760',
    svg: [
      box({ x: 180, y: 90, width: 840, height: 58, color: 'cloud', title: 'Role', lines: ['query service owner, docs builder, hosted server owner, MCP server owner'] }),
      box({ x: 180, y: 180, width: 840, height: 58, color: 'frontend', title: 'Capability', lines: ['query, trace, inspect, publish docs, stage artifacts, optionally synthesize answer text'] }),
      box({ x: 180, y: 270, width: 840, height: 72, color: 'backend', title: 'Method', lines: ['core retrieval + app services + composition rules'], tiny: ['optional local synthesis is one bounded mechanism here'] }),
      box({ x: 180, y: 374, width: 840, height: 58, color: 'generic', title: 'WorkPlan', lines: ['MCP boot, hosted boot, docs generation, build staging, health checks'] }),
      box({ x: 180, y: 464, width: 840, height: 72, color: 'messageBus', title: 'Work', lines: ['deterministic retrieval, optional synthesis, publication, staging'], tiny: ['resource consumption belongs here, not to role or method'] }),
      box({ x: 180, y: 568, width: 840, height: 58, color: 'database', title: 'Evidence', lines: ['tests, docs build output, runtime status, staged artifacts, fallback behavior'] }),
      arrow({ x1: 600, y1: 148, x2: 600, y2: 180, color: '#64748b' }),
      arrow({ x1: 600, y1: 238, x2: 600, y2: 270, color: '#64748b' }),
      arrow({ x1: 600, y1: 342, x2: 600, y2: 374, color: '#64748b' }),
      arrow({ x1: 600, y1: 432, x2: 600, y2: 464, color: '#64748b' }),
      arrow({ x1: 600, y1: 536, x2: 600, y2: 568, color: '#64748b' }),
      `<text x="180" y="690" fill="#94a3b8" font-size="9">Rule of thumb: if a sentence could fit in more than one row, it probably needs to be split.</text>`,
    ].join('\n'),
    cards: [
      {
        dot: 'violet',
        title: 'Viewpoint',
        items: [
          'Described entity: FPF memory runtime role/method/work structure',
          'Viewpoint: separation / anti-category-error stack',
          'Temporal mode: design-time description',
        ],
      },
      {
        dot: 'emerald',
        title: 'Reading Rule',
        items: [
          'Method and plan belong to design-time.',
          'Work belongs to run-time actuals.',
          'Evidence binds to work, not to abstract role claims.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'A.15 role / capability / method / plan / work separation',
          'B.5.1 lifecycle tags belong on artifacts',
          'C.2.1 one viewpoint per artifact',
        ],
      },
    ],
    footer: 'Generated as a standalone role-method-work separation diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-lifecycle-compat-governance.html',
    title: 'FPF Memory | Lifecycle and Compat Governance',
    subtitle:
      'Artifact governance view. Owners, lifecycle state, optional LLM usage, determinism, and compat handling are shown explicitly.',
    viewBox: '0 0 1200 760',
    svg: [
      boundary({ x: 60, y: 80, width: 1080, height: 540, label: 'Governance Matrix', color: 'cloud' }),
      `<rect x="90" y="120" width="220" height="38" rx="4" fill="rgba(30,41,59,0.8)" stroke="#94a3b8" stroke-width="1"/>`,
      `<rect x="310" y="120" width="180" height="38" rx="4" fill="rgba(30,41,59,0.8)" stroke="#94a3b8" stroke-width="1"/>`,
      `<rect x="490" y="120" width="160" height="38" rx="4" fill="rgba(30,41,59,0.8)" stroke="#94a3b8" stroke-width="1"/>`,
      `<rect x="650" y="120" width="130" height="38" rx="4" fill="rgba(30,41,59,0.8)" stroke="#94a3b8" stroke-width="1"/>`,
      `<rect x="780" y="120" width="120" height="38" rx="4" fill="rgba(30,41,59,0.8)" stroke="#94a3b8" stroke-width="1"/>`,
      `<rect x="900" y="120" width="210" height="38" rx="4" fill="rgba(30,41,59,0.8)" stroke="#94a3b8" stroke-width="1"/>`,
      `<text x="200" y="145" fill="white" font-size="10" font-weight="600" text-anchor="middle">Artifact</text>`,
      `<text x="400" y="145" fill="white" font-size="10" font-weight="600" text-anchor="middle">Owner</text>`,
      `<text x="570" y="145" fill="white" font-size="10" font-weight="600" text-anchor="middle">Lifecycle</text>`,
      `<text x="715" y="145" fill="white" font-size="10" font-weight="600" text-anchor="middle">LLM</text>`,
      `<text x="840" y="145" fill="white" font-size="10" font-weight="600" text-anchor="middle">Deterministic</text>`,
      `<text x="1005" y="145" fill="white" font-size="10" font-weight="600" text-anchor="middle">Interpretation</text>`,
      ...[
        ['Deterministic query result', 'Ctx.App / Runtime', 'operation', 'no', 'yes', 'base answer path'],
        ['Synthesized query result', 'Ctx.App / Runtime', 'operation', 'optional local synth', 'fallback only', 'same grounding, refined text'],
        ['GenerateDocsResult', 'Ctx.Docs', 'evidence', 'none', 'yes', 'publication artifact'],
        ['BuildArtifactManifest', 'Ctx.Build', 'operation', 'none', 'yes', 'staging record'],
        ['Mastra compat shim', 'Ctx.Compat.Mastra', 'operation', 'none directly', 'bootstrap only', 'governed exception'],
      ].map((row, index) => {
        const y = 180 + index * 84;
        return `
        <rect x="90" y="${y}" width="220" height="64" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <rect x="310" y="${y}" width="180" height="64" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <rect x="490" y="${y}" width="160" height="64" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <rect x="650" y="${y}" width="130" height="64" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <rect x="780" y="${y}" width="120" height="64" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <rect x="900" y="${y}" width="210" height="64" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <text x="200" y="${y + 22}" fill="white" font-size="9" text-anchor="middle">${esc(row[0])}</text>
        <text x="400" y="${y + 22}" fill="#94a3b8" font-size="9" text-anchor="middle">${esc(row[1])}</text>
        <text x="570" y="${y + 22}" fill="#94a3b8" font-size="9" text-anchor="middle">${esc(row[2])}</text>
        <text x="715" y="${y + 22}" fill="#94a3b8" font-size="9" text-anchor="middle">${esc(row[3])}</text>
        <text x="840" y="${y + 22}" fill="#94a3b8" font-size="9" text-anchor="middle">${esc(row[4])}</text>
        <text x="1005" y="${y + 22}" fill="#94a3b8" font-size="8" text-anchor="middle">${esc(row[5])}</text>`;
      }),
      `<text x="90" y="648" fill="#94a3b8" font-size="9">Lifecycle tags should be explicit on the artifact. Skipping a lifecycle state requires justification.</text>`,
    ].join('\n'),
    cards: [
      {
        dot: 'violet',
        title: 'Viewpoint',
        items: [
          'Described entity: runtime-related governance artifacts',
          'Viewpoint: lifecycle + compat governance matrix',
          'Artifact class: design-time evidence description',
        ],
      },
      {
        dot: 'rose',
        title: 'Governance Rules',
        items: [
          'Only one row uses optional local synthesis.',
          'Docs and build remain deterministic.',
          'Compat is a governed exception, not a second architecture.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'B.5.1 lifecycle labeling',
          'A.6 layer identification',
          'E.17 no new semantics on publication faces',
        ],
      },
    ],
    footer: 'Generated as a standalone lifecycle-governance diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-detailed-context-map.html',
    title: 'FPF Memory | Detailed Context Map',
    subtitle:
      'Detailed ownership view. Same bounded contexts as the high-level map, with repo-specific modules and adapters called out explicitly.',
    viewBox: '0 0 1200 760',
    svg: [
      boundary({ x: 70, y: 60, width: 1060, height: 260, label: 'Internal Implementation Contexts', color: 'cloud' }),
      boundary({ x: 70, y: 360, width: 1060, height: 290, label: 'Adapters and Surfaces', color: 'cloud' }),
      arrow({ x1: 250, y1: 190, x2: 380, y2: 190, color: '#34d399', label: 'use domain + retrieval', labelX: 312, labelY: 182 }),
      arrow({ x1: 500, y1: 190, x2: 640, y2: 190, color: '#34d399', label: 'edge config + observability', labelX: 570, labelY: 182 }),
      arrow({ x1: 770, y1: 190, x2: 910, y2: 190, color: '#fbbf24', label: 'wire runtime + tools', labelX: 840, labelY: 182 }),
      arrow({ x1: 1040, y1: 190, x2: 1120, y2: 190, color: '#fb923c', label: 'optional synth', labelX: 1080, labelY: 182 }),
      arrow({ x1: 980, y1: 240, x2: 220, y2: 438, color: '#22d3ee', label: 'create MCP surface', labelX: 546, labelY: 316 }),
      arrow({ x1: 980, y1: 240, x2: 460, y2: 438, color: '#22d3ee', label: 'create hosted surface', labelX: 680, labelY: 342 }),
      arrow({ x1: 420, y1: 240, x2: 720, y2: 438, color: '#a78bfa', label: 'feed docs generation', labelX: 540, labelY: 330 }),
      arrow({ x1: 700, y1: 240, x2: 980, y2: 438, color: '#fbbf24', label: 'feed build staging', labelX: 860, labelY: 340 }),
      arrow({ x1: 980, y1: 240, x2: 980, y2: 600, color: '#fb7185', label: 'compat shim only', labelX: 1036, labelY: 420 }),
      box({ x: 90, y: 130, width: 160, height: 78, color: 'backend', title: 'Ctx.Core', lines: ['compiled nodes', 'routes + retrieval engine'] }),
      box({ x: 380, y: 120, width: 120, height: 92, color: 'backend', title: 'Ctx.App', lines: ['QueryAppService', 'TraceAppService', 'InspectAppService'] }),
      box({ x: 640, y: 120, width: 130, height: 92, color: 'cloud', title: 'Ctx.Infra', lines: ['env parser', 'observability', 'synth config'] }),
      box({ x: 910, y: 120, width: 130, height: 92, color: 'generic', title: 'Composition', lines: ['runtime.ts', 'mcp.ts', 'cli.ts'] }),
      box({ x: 1120, y: 120, width: 90, height: 92, color: 'messageBus', title: 'LmStudio', lines: ['optional synthesizer'] }),
      box({ x: 130, y: 438, width: 180, height: 72, color: 'frontend', title: 'Ctx.Run.MCP', lines: ['tool contracts + stdio server'] }),
      box({ x: 390, y: 438, width: 160, height: 72, color: 'frontend', title: 'Ctx.Run.Hosted', lines: ['Mastra runtime + hosted boot'] }),
      box({ x: 640, y: 438, width: 160, height: 72, color: 'database', title: 'Ctx.Docs', lines: ['generated markdown pages'] }),
      box({ x: 900, y: 438, width: 160, height: 72, color: 'cloud', title: 'Ctx.Build', lines: ['deploy staging + manifest'] }),
      box({ x: 900, y: 560, width: 160, height: 72, color: 'security', title: 'Ctx.Compat.Mastra', lines: ['import-time bootstrap shim'] }),
      `<text x="90" y="688" fill="#94a3b8" font-size="9">Detailed rule: the same contexts exist as in the high-level map; this view only expands their concrete repo-owned modules.</text>`,
    ].join('\n'),
    cards: [
      {
        dot: 'cyan',
        title: 'Viewpoint',
        items: [
          'Described entity: repo-specific runtime implementation ownership',
          'Viewpoint: detailed bounded-context map',
          'Temporal mode: design-time description',
        ],
      },
      {
        dot: 'emerald',
        title: 'What Changed',
        items: [
          'This view expands the high-level map with actual module ownership.',
          'It still keeps one bridge and one optional synthesis path.',
          'It does not try to become a runtime flow diagram.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'A.1.1 bounded contexts',
          'C.2.1 one viewpoint per artifact',
          'E.10 kind-explicit labels',
        ],
      },
    ],
    footer: 'Generated as a standalone detailed-context diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-request-flow.html',
    title: 'FPF Memory | Request Flow',
    subtitle:
      'Runtime work view. Read left to right, then follow the deterministic result or the optional local synthesis branch.',
    viewBox: '0 0 1200 760',
    svg: [
      arrow({ x1: 180, y1: 210, x2: 290, y2: 210, label: 'send', labelX: 235, labelY: 202 }),
      arrow({ x1: 420, y1: 210, x2: 530, y2: 210, label: 'map DTO', labelX: 475, labelY: 202 }),
      arrow({ x1: 660, y1: 210, x2: 770, y2: 210, label: 'invoke', labelX: 715, labelY: 202 }),
      arrow({ x1: 900, y1: 210, x2: 1010, y2: 210, label: 'execute', labelX: 955, labelY: 202 }),
      pathArrow({ d: 'M 1070 250 C 980 340, 390 340, 390 430', label: 'primary result', labelX: 780, labelY: 358 }),
      pathArrow({ d: 'M 1110 250 C 1030 350, 760 350, 760 430', label: 'optional branch', labelX: 980, labelY: 384 }),
      arrow({ x1: 890, y1: 500, x2: 960, y2: 500, label: 'if available', labelX: 924, labelY: 492 }),
      box({ x: 60, y: 160, width: 120, height: 72, color: 'generic', title: '1 User', lines: ['asks question'] }),
      box({ x: 290, y: 160, width: 130, height: 72, color: 'frontend', title: '2 Boundary Face', lines: ['CLI, MCP, or hosted'] }),
      box({ x: 530, y: 160, width: 130, height: 72, color: 'cloud', title: '3 Composition', lines: ['validate + wire'] }),
      box({ x: 770, y: 160, width: 130, height: 72, color: 'backend', title: '4 App Service', lines: ['query / trace / inspect'] }),
      box({ x: 1010, y: 160, width: 140, height: 72, color: 'backend', title: '5 Runtime', lines: ['deterministic retrieval'] }),
      box({ x: 250, y: 430, width: 140, height: 90, color: 'database', title: 'Deterministic Result', lines: ['primary output path'] }),
      box({ x: 620, y: 420, width: 270, height: 116, color: 'messageBus', title: 'Optional Local LLM', lines: ['answer synthesis only', 'used after retrieval'], tiny: ['fallback = deterministic result'] }),
      box({ x: 960, y: 430, width: 180, height: 90, color: 'messageBus', title: 'Synthesized Result', lines: ['optional refined answer'] }),
      `<rect x="70" y="600" width="1080" height="70" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1"/>`,
      `<text x="90" y="628" fill="#94a3b8" font-size="9">Docs publication and build staging are separate systems and intentionally omitted from this runtime-work view.</text>`,
    ].join('\n'),
    cards: [
      {
        dot: 'cyan',
        title: 'Viewpoint',
        items: [
          'Described entity: query execution work',
          'Viewpoint: runtime work flow',
          'Temporal mode: run-time work description',
        ],
      },
      {
        dot: 'rose',
        title: 'Flow Rule',
        items: [
          'Deterministic retrieval is the primary answer path.',
          'Local synthesis is optional and happens afterward.',
          'Docs/build are intentionally off this view.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'A.15 work stays distinct from method and plan',
          'A.6 do not mix publication layers into runtime work',
          'Optional local synthesis is bounded, not ambient',
        ],
      },
    ],
    footer: 'Generated as a standalone runtime-work diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-before-after-refactor.html',
    title: 'FPF Memory | Before / After Refactor',
    subtitle:
      'Comparison view. The left side captures the old confusion surfaces; the right side shows the current boundary-typed architecture.',
    viewBox: '0 0 1200 760',
    svg: [
      boundary({ x: 100, y: 90, width: 420, height: 430, label: 'Before', color: 'security' }),
      boundary({ x: 680, y: 90, width: 420, height: 430, label: 'After', color: 'cloud' }),
      box({ x: 140, y: 130, width: 340, height: 68, color: 'security', title: 'Module-scope runtime boot', lines: ['transport code owned too much setup'] }),
      box({ x: 140, y: 220, width: 340, height: 68, color: 'security', title: 'Runtime env reads', lines: ['edge concerns leaked inward'] }),
      box({ x: 140, y: 310, width: 340, height: 68, color: 'security', title: 'Docs mixed into runtime', lines: ['publication looked like runtime work'] }),
      box({ x: 140, y: 400, width: 340, height: 68, color: 'security', title: 'LLM boundary implicit', lines: ['easy to overstate or misplace'] }),
      box({ x: 720, y: 130, width: 340, height: 68, color: 'backend', title: 'Edge config parsing', lines: ['infra/composition own the boundary'] }),
      box({ x: 720, y: 220, width: 340, height: 68, color: 'generic', title: 'Composition-owned bridges', lines: ['one approved wiring layer'] }),
      box({ x: 720, y: 310, width: 340, height: 68, color: 'database', title: 'Docs/build separated', lines: ['publication and artifacts are explicit systems'] }),
      box({ x: 720, y: 400, width: 340, height: 68, color: 'messageBus', title: 'LLM bounded to synthesis', lines: ['optional, after retrieval, not ambient'] }),
      arrow({ x1: 520, y1: 306, x2: 680, y2: 306, color: '#22d3ee', label: 'refactor delta', labelX: 600, labelY: 296 }),
      `<text x="140" y="560" fill="#94a3b8" font-size="9">Promises preserved: MCP ids, CLI flags, docs paths, hosted staging.</text>`,
    ].join('\n'),
    cards: [
      {
        dot: 'rose',
        title: 'Before',
        items: [
          'Boundary concerns were implicit.',
          'Transport boot and runtime meaning were too close.',
          'LLM usage was easier to misread.',
        ],
      },
      {
        dot: 'emerald',
        title: 'After',
        items: [
          'Bounded contexts are explicit.',
          'Composition owns bridges and boot wiring.',
          'Local synthesis is clearly optional and contained.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'A.1.1 bounded contexts',
          'A.6 boundary faces and layer separation',
          'A.15 role/method/work separation',
        ],
      },
    ],
    footer: 'Generated as a standalone refactor-comparison diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-architecture-pack.html',
    title: 'FPF Memory | Architecture Pack',
    subtitle:
      'Overview poster. A compact four-panel summary of the main architecture viewpoints without replacing the dedicated diagram pages.',
    viewBox: '0 0 1200 820',
    svg: [
      packPanel(
        40,
        40,
        540,
        300,
        '1. Bounded Contexts',
        'ownership and bridge',
        `
        ${box({ x: 70, y: 100, width: 120, height: 52, color: 'backend', title: 'Core', lines: ['meaning'] })}
        ${box({ x: 220, y: 100, width: 120, height: 52, color: 'backend', title: 'App', lines: ['services'] })}
        ${box({ x: 370, y: 100, width: 140, height: 52, color: 'generic', title: 'Composition', lines: ['bridge'] })}
        ${arrow({ x1: 190, y1: 126, x2: 220, y2: 126, color: '#34d399' })}
        ${arrow({ x1: 340, y1: 126, x2: 370, y2: 126, color: '#64748b' })}
        ${box({ x: 110, y: 220, width: 120, height: 52, color: 'frontend', title: 'MCP', lines: ['runtime face'] })}
        ${box({ x: 270, y: 220, width: 120, height: 52, color: 'database', title: 'Docs', lines: ['publication'] })}
        ${arrow({ x1: 430, y1: 152, x2: 170, y2: 220, color: '#22d3ee' })}
        ${arrow({ x1: 430, y1: 152, x2: 330, y2: 220, color: '#a78bfa' })}`,
      ),
      packPanel(
        620,
        40,
        540,
        300,
        '2. Boundary Faces',
        'face is not the system',
        `
        ${box({ x: 650, y: 100, width: 110, height: 52, color: 'frontend', title: 'MCP', lines: ['face'] })}
        ${box({ x: 810, y: 100, width: 150, height: 52, color: 'generic', title: 'Canonical Runtime', lines: ['composition + runtime'] })}
        ${box({ x: 1010, y: 100, width: 100, height: 52, color: 'database', title: 'Docs', lines: ['face'] })}
        ${arrow({ x1: 760, y1: 126, x2: 810, y2: 126 })}
        ${arrow({ x1: 960, y1: 126, x2: 1010, y2: 126 })}
        ${box({ x: 855, y: 220, width: 120, height: 52, color: 'messageBus', title: 'Local LLM', lines: ['optional'] })}
        ${arrow({ x1: 885, y1: 152, x2: 915, y2: 220, color: '#fb923c' })}`,
      ),
      packPanel(
        40,
        380,
        540,
        300,
        '3. Role / Method / Work',
        'keep the rows distinct',
        `
        ${box({ x: 90, y: 430, width: 440, height: 42, color: 'cloud', title: 'Role', lines: ['query/docs/build owners'] })}
        ${box({ x: 90, y: 484, width: 440, height: 42, color: 'frontend', title: 'Capability', lines: ['query / trace / publish / stage'] })}
        ${box({ x: 90, y: 538, width: 440, height: 42, color: 'backend', title: 'Method', lines: ['retrieval + composition'] })}
        ${box({ x: 90, y: 592, width: 440, height: 42, color: 'messageBus', title: 'Work', lines: ['deterministic + optional synthesis'] })}`,
      ),
      packPanel(
        620,
        380,
        540,
        300,
        '4. Lifecycle / Compat',
        'owner, state, determinism',
        `
        ${box({ x: 650, y: 430, width: 220, height: 52, color: 'database', title: 'Docs Result', lines: ['Ctx.Docs | evidence'] })}
        ${box({ x: 900, y: 430, width: 220, height: 52, color: 'cloud', title: 'Build Manifest', lines: ['Ctx.Build | operation'] })}
        ${box({ x: 650, y: 520, width: 220, height: 52, color: 'messageBus', title: 'Synthesized Result', lines: ['optional LLM branch'] })}
        ${box({ x: 900, y: 520, width: 220, height: 52, color: 'security', title: 'Compat Shim', lines: ['explicit exception'] })}`,
      ),
    ].join('\n'),
    cards: [
      {
        dot: 'cyan',
        title: 'Purpose',
        items: [
          'This page is an overview poster, not a replacement for the detailed diagrams.',
          'Each panel corresponds to a dedicated viewpoint-specific artifact.',
        ],
      },
      {
        dot: 'emerald',
        title: 'How To Use It',
        items: [
          'Start here for orientation.',
          'Then open the dedicated diagram page for the viewpoint you actually need.',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'C.2.1 one episteme view per real artifact',
          'This pack is a navigational summary only',
        ],
      },
    ],
    footer: 'Generated as a standalone overview-pack diagram artifact from the architecture-diagram skill.',
  },
  {
    fileName: 'fpf-runtime-detailed-views.html',
    title: 'FPF Memory | Detailed Views',
    subtitle:
      'Overview poster for the more detailed architecture artifacts: module ownership, runtime work flow, and before/after comparison.',
    viewBox: '0 0 1200 760',
    svg: [
      packPanel(
        40,
        40,
        1120,
        180,
        '1. Detailed Context Map',
        'module ownership expansion',
        `
        ${box({ x: 90, y: 100, width: 160, height: 54, color: 'backend', title: 'Core', lines: ['compiled nodes + retrieval'] })}
        ${box({ x: 300, y: 100, width: 160, height: 54, color: 'backend', title: 'App', lines: ['Query/Trace/Inspect'] })}
        ${box({ x: 510, y: 100, width: 160, height: 54, color: 'cloud', title: 'Infra', lines: ['env + observability'] })}
        ${box({ x: 720, y: 100, width: 160, height: 54, color: 'generic', title: 'Composition', lines: ['runtime + mcp + cli'] })}
        ${box({ x: 930, y: 100, width: 140, height: 54, color: 'messageBus', title: 'LmStudio', lines: ['optional synth'] })}
        ${arrow({ x1: 250, y1: 126, x2: 300, y2: 126 })}
        ${arrow({ x1: 460, y1: 126, x2: 510, y2: 126 })}
        ${arrow({ x1: 670, y1: 126, x2: 720, y2: 126 })}`,
      ),
      packPanel(
        40,
        260,
        1120,
        200,
        '2. Runtime Request Flow',
        'deterministic first, optional synthesis second',
        `
        ${box({ x: 90, y: 320, width: 120, height: 52, color: 'generic', title: 'User', lines: ['question'] })}
        ${box({ x: 250, y: 320, width: 130, height: 52, color: 'frontend', title: 'Face', lines: ['CLI / MCP / hosted'] })}
        ${box({ x: 420, y: 320, width: 130, height: 52, color: 'cloud', title: 'Composition', lines: ['validate + wire'] })}
        ${box({ x: 590, y: 320, width: 130, height: 52, color: 'backend', title: 'App', lines: ['query service'] })}
        ${box({ x: 760, y: 320, width: 150, height: 52, color: 'backend', title: 'Runtime', lines: ['deterministic retrieval'] })}
        ${box({ x: 950, y: 320, width: 130, height: 52, color: 'messageBus', title: 'Local LLM', lines: ['optional synth'] })}
        ${arrow({ x1: 210, y1: 346, x2: 250, y2: 346 })}
        ${arrow({ x1: 380, y1: 346, x2: 420, y2: 346 })}
        ${arrow({ x1: 550, y1: 346, x2: 590, y2: 346 })}
        ${arrow({ x1: 720, y1: 346, x2: 760, y2: 346 })}
        ${arrow({ x1: 910, y1: 346, x2: 950, y2: 346, label: 'optional', labelX: 930, labelY: 338 })}`,
      ),
      packPanel(
        40,
        500,
        1120,
        180,
        '3. Before / After Refactor',
        'comparison viewpoint',
        `
        ${box({ x: 110, y: 560, width: 360, height: 72, color: 'security', title: 'Before', lines: ['implicit boundaries', 'runtime env leaks', 'docs/runtime blur'] })}
        ${box({ x: 700, y: 560, width: 360, height: 72, color: 'backend', title: 'After', lines: ['explicit contexts', 'composition-owned bridge', 'LLM bounded to synthesis'] })}
        ${arrow({ x1: 470, y1: 596, x2: 700, y2: 596, label: 'refactor delta', labelX: 585, labelY: 586 })}`,
      ),
    ].join('\n'),
    cards: [
      {
        dot: 'cyan',
        title: 'Purpose',
        items: [
          'This page summarizes the detailed-view family.',
          'It is useful for orientation before opening the dedicated pages.',
        ],
      },
      {
        dot: 'emerald',
        title: 'Detailed Family',
        items: [
          'Detailed context map = module ownership',
          'Request flow = runtime work',
          'Before/after = architectural delta',
        ],
      },
      {
        dot: 'amber',
        title: 'FPF Discipline',
        items: [
          'Each detailed artifact still preserves one main viewpoint',
          'This page is a summary surface, not a semantic expansion',
        ],
      },
    ],
    footer: 'Generated as a standalone detailed-views summary artifact from the architecture-diagram skill.',
  },
];

function diagramIndexPage(pagesList: DiagramPage[]): string {
  const links = pagesList
    .map(
      (page) => `
      <div class="card">
        <div class="card-header">
          <div class="card-dot cyan"></div>
          <h3>${esc(page.title)}</h3>
        </div>
        <ul>
          <li>• <a href="./${esc(page.fileName)}">${esc(page.fileName)}</a></li>
          <li>• ${esc(page.subtitle)}</li>
        </ul>
      </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FPF Memory | Architecture HTML Pack</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'JetBrains Mono', monospace; background: #020617; min-height: 100vh; padding: 2rem; color: white; }
    .container { max-width: 1280px; margin: 0 auto; }
    .header-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .pulse-dot { width: 12px; height: 12px; background: #22d3ee; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    h1 { font-size: 1.5rem; font-weight: 700; }
    .subtitle { color: #94a3b8; font-size: 0.875rem; margin-left: 1.75rem; margin-bottom: 2rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
    .card { background: rgba(15,23,42,0.5); border: 1px solid #1e293b; border-radius: 0.75rem; padding: 1.25rem; }
    .card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .card-dot { width: 8px; height: 8px; border-radius: 50%; background: #22d3ee; }
    .card h3 { font-size: 0.875rem; font-weight: 600; }
    .card ul { list-style: none; color: #94a3b8; font-size: 0.75rem; }
    .card li { margin-bottom: 0.375rem; line-height: 1.45; }
    a { color: #22d3ee; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { text-align: center; margin-top: 1.5rem; color: #475569; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <div class="pulse-dot"></div>
      <h1>FPF Memory Architecture HTML Pack</h1>
    </div>
    <p class="subtitle">Standalone dark-themed diagram pages generated from the architecture-diagram skill.</p>
    <div class="cards">
      ${links}
    </div>
    <div class="footer">Generated as a navigational index for the architecture-diagram skill outputs.</div>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  const outDir = resolve(process.cwd(), 'docs/architecture/html');
  await mkdir(outDir, { recursive: true });
  const existingFiles = await readdir(outDir);

  for (const fileName of existingFiles) {
    if (fileName.endsWith('.html')) {
      await unlink(join(outDir, fileName));
    }
  }

  for (const page of pages) {
    await writeFile(join(outDir, page.fileName), pageTemplate(page), 'utf8');
  }

  await writeFile(join(outDir, 'index.html'), diagramIndexPage(pages), 'utf8');
}

await main();
