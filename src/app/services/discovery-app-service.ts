import type {
  AppServiceOutcome,
  BrowseFpfCatalogCommand,
  SearchFpfCommand,
} from '../commands/index.js';
import { runtimeError, success, validationError } from '../commands/index.js';
import type { RuntimeQueryPort } from '../ports/runtime-port.js';
import type { BrowseCatalogResult, SearchResult } from '../../core/types.js';

export class DiscoveryAppService {
  constructor(private readonly runtime: RuntimeQueryPort) {}

  async browse(
    command: BrowseFpfCatalogCommand,
  ): Promise<AppServiceOutcome<BrowseCatalogResult>> {
    try {
      return success(
        await this.runtime.browse({
          part: command.part,
          status: command.status,
          kind: command.kind,
          limit: command.limit,
          forceRefresh: command.forceRefresh ?? false,
        }),
      );
    } catch (error) {
      return runtimeError(error);
    }
  }

  async search(
    command: SearchFpfCommand,
  ): Promise<AppServiceOutcome<SearchResult>> {
    if (!command.query.trim()) {
      return validationError('Search query must not be empty', ['query']);
    }

    try {
      return success(
        await this.runtime.search(command.query.trim(), {
          kind: command.kind,
          limit: command.limit,
          forceRefresh: command.forceRefresh ?? false,
        }),
      );
    } catch (error) {
      return runtimeError(error);
    }
  }
}
