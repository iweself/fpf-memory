import { runCli } from '../composition/cli-runner.js';

export async function main(argv = process.argv.slice(2)): Promise<void> {
  await runCli(argv);
}
