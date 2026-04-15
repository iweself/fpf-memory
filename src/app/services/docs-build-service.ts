import type { AppServiceOutcome } from '../commands/index.js';
import { runtimeError, success } from '../commands/index.js';
import type {
  DocsBuildPort,
  GenerateDocsOptions,
  GenerateDocsResult,
} from '../ports/docs-build-port.js';

export class DocsBuildService {
  constructor(private readonly docsBuilder: DocsBuildPort) {}

  async generate(
    options: GenerateDocsOptions = {},
  ): Promise<AppServiceOutcome<GenerateDocsResult>> {
    try {
      return success(await this.docsBuilder.generate(options));
    } catch (error) {
      return runtimeError(error);
    }
  }
}
