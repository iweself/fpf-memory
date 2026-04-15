import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Pinned to an immutable commit SHA so CI and deploy builds are reproducible.
// Override with FPF_UPSTREAM_SPEC_URL to test against a newer upstream; bump
// this constant when rolling the pin forward.
const DEFAULT_UPSTREAM_REF = '75536eb67fe58e6ffe5c87d21631403fd71c3e10';
const DEFAULT_URL = `https://raw.githubusercontent.com/venikman/fpf-sync/${DEFAULT_UPSTREAM_REF}/FPF/FPF-Spec.md`;
const DEFAULT_OUTPUT = '.fpf-upstream/FPF-Spec.md';

const url = (process.env.FPF_UPSTREAM_SPEC_URL ?? DEFAULT_URL).trim();
const outputPath = resolve(
  process.cwd(),
  (process.env.FPF_DOWNLOAD_SPEC_OUTPUT ?? DEFAULT_OUTPUT).trim(),
);

const response = await fetch(url);
if (!response.ok) {
  process.stderr.write(
    `download-upstream-spec: HTTP ${response.status} for ${url}\n`,
  );
  process.exit(1);
}

const text = await response.text();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, text, 'utf8');

process.stdout.write(
  `${JSON.stringify(
    {
      url,
      outputPath,
      bytes: Buffer.byteLength(text, 'utf8'),
    },
    null,
    2,
  )}\n`,
);
