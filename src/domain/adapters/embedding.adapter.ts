/**
 * Text embedding port (PASO 3). Implemented in infrastructure by the Gemini
 * embeddings adapter. Turns a statement into a dense vector for the
 * redundancy comparison.
 */
export abstract class EmbeddingAdapter {
  /** Model identifier used to produce the vector — stored for traceability. */
  abstract get modelVersion(): string;

  abstract embed(text: string): Promise<number[]>;
}
