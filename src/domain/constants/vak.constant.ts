export const VAK_STYLES = ["Visual", "Auditory", "Kinesthetic"] as const;
export type VakStyle = (typeof VAK_STYLES)[number];

export const VAK_VALUES = ["V", "A", "K"] as const;
export type VakValue = (typeof VAK_VALUES)[number];

/** Option label (`vakValue`) to question style (`vakStyle`). */
export const VAK_STYLE_BY_VALUE: Record<VakValue, VakStyle> = {
  V: "Visual",
  A: "Auditory",
  K: "Kinesthetic",
};

/**
 * HU-20: a well-formed question has 4 options where exactly one label appears
 * twice (2-1-1). Returns that label's style, or null when the options do not
 * follow the distribution (legacy or incomplete data).
 */
export function doubledOptionStyle(vakValues: string[]): VakStyle | null {
  if (vakValues.length !== 4) return null;
  const counts = new Map<string, number>();
  for (const value of vakValues) counts.set(value, (counts.get(value) ?? 0) + 1);
  const doubled = [...counts.entries()].filter(([, count]) => count === 2);
  if (doubled.length !== 1 || counts.size !== 3) return null;
  return VAK_STYLE_BY_VALUE[doubled[0][0] as VakValue] ?? null;
}
