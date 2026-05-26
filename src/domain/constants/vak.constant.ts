export const VAK_STYLES = ["Visual", "Auditory", "Kinesthetic"] as const;
export type VakStyle = (typeof VAK_STYLES)[number];

export const VAK_VALUES = ["V", "A", "K"] as const;
export type VakValue = (typeof VAK_VALUES)[number];
