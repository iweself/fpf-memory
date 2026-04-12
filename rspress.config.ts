import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from '@rspress/core';

import { buildDocsNavigation } from './src/docs/projection.js';
import { compileFpfSource } from './src/runtime/compiler.js';

const docsRoot = process.env.FPF_DOCS_ROOT ?? 'docs';
const outDir = process.env.FPF_DOCS_OUT_DIR ?? 'doc_build';

const sourcePath = resolve(
  process.cwd(),
  process.env.FPF_SPEC_SOURCE_PATH ?? 'FPF-spec.md',
);
const sourceText = readFileSync(sourcePath, 'utf8');
const sourceHash = `sha256:${createHash('sha256').update(sourceText).digest('hex')}`;
const snapshot = compileFpfSource({
  sourcePath,
  sourceHash,
  builtAt: 'docs-nav',
  sourceText,
}).snapshot;
const navigation = buildDocsNavigation(snapshot);

export default defineConfig({
  root: docsRoot,
  outDir,
  base: '/fpf-memory/',
  title: 'FPF Reference',
  description: 'Compiler-backed FPF reference docs generated from FPF-spec.md.',
  globalStyles: resolve(process.cwd(), 'src/docs/density.css'),
  route: {
    cleanUrls: true,
  },
  markdown: {
    link: {
      checkDeadLinks: {
        excludes: ['/drr/DRR-0001-mcp-first-class-interface/'],
      },
    },
  },
  themeConfig: {
    nav: [
      {
        text: 'Patterns',
        link: '/generated/patterns/index',
      },
      {
        text: 'Routes',
        link: '/generated/routes/index',
      },
      {
        text: 'Preface',
        link: '/generated/preface/index',
      },
      {
        text: 'Decision Records',
        link: '/drr/DRR-0001-mcp-first-class-interface/',
      },
    ],
    sidebar: {
      '/': [
        {
          text: 'Patterns',
          items: [
            {
              text: 'Pattern Catalog',
              link: '/generated/patterns/index',
            },
            ...navigation.patterns.map((group) => ({
              text: group.text,
              collapsible: true,
              collapsed: false,
              items: group.items,
            })),
          ],
        },
      ],
      '/generated/patterns/': [
        {
          text: 'Patterns',
          items: [
            {
              text: 'Pattern Catalog',
              link: '/generated/patterns/index',
            },
            ...navigation.patterns.map((group) => ({
              text: group.text,
              collapsible: true,
              collapsed: false,
              items: group.items,
            })),
          ],
        },
      ],
      '/generated/routes/': [
        {
          text: 'Routes',
          items: [
            {
              text: 'Route Catalog',
              link: '/generated/routes/index',
            },
            ...navigation.routes.map((group) => ({
              text: group.text,
              collapsible: true,
              collapsed: false,
              items: group.items,
            })),
          ],
        },
      ],
      '/generated/preface/': [
        {
          text: 'Preface',
          items: [
            {
              text: 'Preface Catalog',
              link: '/generated/preface/index',
            },
            ...navigation.preface.map((group) => ({
              text: group.text,
              collapsible: true,
              collapsed: false,
              items: group.items,
            })),
          ],
        },
        {
          text: 'Additional',
          collapsible: true,
          collapsed: true,
          items: [
            {
              text: 'MCP Interface',
              link: '/mcp-interface/',
            },
          ],
        },
      ],
      '/mcp-interface/': [
        {
          text: 'Additional',
          items: [
            {
              text: 'MCP Interface',
              link: '/mcp-interface/',
            },
            {
              text: 'DRR-0001',
              link: '/drr/DRR-0001-mcp-first-class-interface/',
            },
          ],
        },
      ],
      '/drr/': [
        {
          text: 'Decision Records',
          items: [
            {
              text: 'DRR-0001',
              link: '/drr/DRR-0001-mcp-first-class-interface/',
            },
          ],
        },
        {
          text: 'Additional',
          items: [
            {
              text: 'MCP Interface',
              link: '/mcp-interface/',
            },
          ],
        },
      ],
    },
    search: true,
    lastUpdated: true,
    enableScrollToTop: true,
    footer: {
      message: 'Built from the local FPF compiler snapshot.',
    },
  },
});
