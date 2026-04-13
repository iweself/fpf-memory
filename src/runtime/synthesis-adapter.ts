import { unique } from './text.js';
import type {
  AnswerMode,
  AnswerSlice,
  CompiledNode,
  LocalAnswerSynthesizer,
  QueryResult,
  TraceResult,
} from './types.js';

export async function synthesizeAnswer(
  question: string,
  mode: AnswerMode,
  trace: TraceResult,
  nodes: CompiledNode[],
  slices: AnswerSlice[],
  deterministicResult: QueryResult,
  synthesizer: LocalAnswerSynthesizer,
): Promise<QueryResult> {
  try {
    const available = await synthesizer.isAvailable();
    if (!available) {
      return deterministicResult;
    }

    const synthesized = await synthesizer.synthesize({
      question,
      mode,
      trace,
      nodes,
      slices,
      deterministicResult,
    });

    return {
      ...deterministicResult,
      answer: synthesized.answer ?? deterministicResult.answer,
      constraints: synthesized.constraints ?? deterministicResult.constraints,
      confidence: synthesized.confidence ?? deterministicResult.confidence,
      gaps: synthesized.gaps ?? deterministicResult.gaps,
      groundingChain: synthesized.groundingChain ?? deterministicResult.groundingChain,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Local synthesizer failed with an unknown error.';
    return {
      ...deterministicResult,
      gaps: unique([...deterministicResult.gaps, `Local synthesis skipped: ${message}`]),
    };
  }
}
