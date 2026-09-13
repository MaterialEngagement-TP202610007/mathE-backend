export const GEMINI_MODELS_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Concatenates every text part of the first candidate. Thought-summary parts
 * (`thought: true`) are skipped. Returns undefined when there is no text.
 */
export function extractCandidateText(payload: any): string | undefined {
  const parts: unknown = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;

  const text = parts
    .filter((part) => typeof part?.text === "string" && part.thought !== true)
    .map((part) => part.text as string)
    .join("");

  return text.length > 0 ? text : undefined;
}
