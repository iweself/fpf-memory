import type { AppServiceOutcome, RefreshFpfIndexCommand } from '../commands/index.js';
import { runtimeError, success } from '../commands/index.js';
import type { RuntimeQueryPort } from '../ports/runtime-port.js';
import type { BuildAudit, RuntimeStatus } from '../../core/types.js';

export class RefreshAppService {
  constructor(private readonly runtime: RuntimeQueryPort) {}

  async refresh(
    command: RefreshFpfIndexCommand = {},
  ): Promise<AppServiceOutcome<BuildAudit>> {
    try {
      return success(await this.runtime.refresh(command.force ?? false));
    } catch (error) {
      return runtimeError(error);
    }
  }

  async status(): Promise<AppServiceOutcome<RuntimeStatus>> {
    try {
      return success(await this.runtime.status());
    } catch (error) {
      return runtimeError(error);
    }
  }
}
