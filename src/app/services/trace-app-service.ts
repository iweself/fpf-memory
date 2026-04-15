import type { TraceFpfCommand, AppServiceOutcome } from '../commands/index.js';
import { runtimeError, success, validationError } from '../commands/index.js';
import type { RuntimeQueryPort } from '../ports/runtime-port.js';
import type { TraceResult } from '../../core/types.js';

export class TraceAppService {
  constructor(private readonly runtime: RuntimeQueryPort) {}

  async execute(command: TraceFpfCommand): Promise<AppServiceOutcome<TraceResult>> {
    const question = command.question.trim();
    if (!question) {
      return validationError('Trace question must not be empty', ['question']);
    }

    try {
      return success(
        await this.runtime.trace(
          question,
          command.mode,
          command.forceRefresh ?? false,
          command.sessionId,
        ),
      );
    } catch (error) {
      return runtimeError(error);
    }
  }
}
