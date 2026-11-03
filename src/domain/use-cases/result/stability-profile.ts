/**
 * HU-38: stability of a student's VAK classification across results.
 *
 * Shared rule for the per-student stats (`GET /results/stats/user/:id`) and the
 * school-wide stability monitor: a student is "stable" when the most frequent
 * predominant style covers at least 60% of their results, otherwise
 * "variable". With fewer than two results there is nothing to compare, so the
 * profile is `null` (insufficient data), never "stable".
 */
export type StabilityProfile = "stable" | "variable";

/** Minimum share of the most frequent style for a "stable" profile. */
export const STABLE_STYLE_SHARE = 0.6;

/** Results needed before a profile can be given. */
export const MIN_RESULTS_FOR_STABILITY = 2;

export function stabilityProfile(
  topStyleCount: number,
  totalResults: number,
): StabilityProfile | null {
  if (totalResults < MIN_RESULTS_FOR_STABILITY) return null;
  return topStyleCount / totalResults >= STABLE_STYLE_SHARE
    ? "stable"
    : "variable";
}
