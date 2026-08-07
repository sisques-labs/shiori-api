export const CHUNKING_STRATEGY_PORT = Symbol('CHUNKING_STRATEGY_PORT');

export interface IChunk {
  text: string;
  position: number;
}

/**
 * Hexagonal seam for the chunk-splitting algorithm. `RecursiveChunkingService`
 * is the default implementation; the port allows swapping in a token-aware or
 * semantic strategy later without touching the processor or command handlers.
 */
export interface IChunkingStrategyPort {
  chunk(content: string): IChunk[];
}
