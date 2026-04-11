import { defineConfig } from 'rspress/config';

export default defineConfig({
  root: 'docs',
  outDir: 'doc_build',
  title: 'FPF Spec Runtime',
  description: 'Compiler-backed FPF reference docs generated from FPF-spec.md.',
  themeConfig: {
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'MCP Interface', link: '/mcp-interface/' },
      { text: 'Patterns', link: '/generated/patterns/' },
      { text: 'Routes', link: '/generated/routes/' },
      { text: 'Preface', link: '/generated/preface/' },
    ],
    sidebar: {
      '/mcp-interface/': [
        {
          text: 'MCP',
          link: '/mcp-interface/',
          items: [{ text: 'MCP Interface', link: '/mcp-interface/' }],
        },
      ],
      '/generated/patterns/': [
        {
          text: 'Patterns',
          link: '/generated/patterns/',
          items: [{ text: 'Patterns Index', link: '/generated/patterns/' }],
        },
      ],
      '/generated/routes/': [
        {
          text: 'Routes',
          link: '/generated/routes/',
          items: [{ text: 'Routes Index', link: '/generated/routes/' }],
        },
      ],
      '/generated/preface/': [
        {
          text: 'Preface',
          link: '/generated/preface/',
          items: [{ text: 'Preface Index', link: '/generated/preface/' }],
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
