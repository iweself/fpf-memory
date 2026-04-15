import type { QueryFpfCommand, AppServiceOutcome } from '../commands/index.js';
import { runtimeError, success, validationError } from '../commands/index.js';
import type { RuntimeQueryPort } from '../ports/runtime-port.js';
import type { QueryResult } from '../../core/types.js';

export class QueryAppService {
  constructor(private readonly runtime: RuntimeQueryPort) {}

  async execute(command: QueryFpfCommand): Promise<AppServiceOutcome<QueryResult>> {
    const question = command.question.trim();
    if (!question) {
      return validationError('Query question must not be empty', ['question']);
    }

    try {
      return success(
        await this.runtime.query(
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
