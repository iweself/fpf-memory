import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SHEBANG = '#!/usr/bin/env node';
const STDIO_ENTRY_PATH = resolve(process.cwd(), 'dist/stdio.js');

// Ensure the published MCP entrypoint is executable for package consumers.
const source = await readFile(STDIO_ENTRY_PATH, 'utf8');

if (!source.startsWith(SHEBANG)) {
  await writeFile(STDIO_ENTRY_PATH, `${SHEBANG}\n${source}`);
}

await chmod(STDIO_ENTRY_PATH, 0o755);
