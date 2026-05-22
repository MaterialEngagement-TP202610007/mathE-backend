/**
 * VAK learning styles and per-option value codes.
 *
 * `VAK_STYLES` — value of `Question.vakStyle` (the style a question targets).
 * `VAK_VALUES` — value of `Option.vakValue` (the style a single option maps to).
 */
export const VAK_STYLES = ["Visual", "Auditory", "Kinesthetic"] as const;
export type VakStyle = (typeof VAK_STYLES)[number];

export const VAK_VALUES = ["V", "A", "K"] as const;
export type VakValue = (typeof VAK_VALUES)[number];
