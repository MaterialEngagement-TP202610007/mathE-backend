/**
 * Pure grouping logic for the MINEDU school registry (padron web).
 *
 * A MINEDU `COD_MOD` identifies an educational *service* (school + level), so
 * one real school appears once per level it offers. Services are merged into
 * one school when they share the same premises (`CODLOCAL`) AND the same
 * normalized name (`CEN_EDU`).
 *
 * Deliberately NOT merged:
 * - homonymous schools in different premises (e.g. two "CLARETIANO" campuses);
 * - different names in the same premises (distinct institutions sharing a building);
 * - one institution code (`CODINST`) spread over different premises — each
 *   campus keeps its own district/address, so it stays a separate school.
 *
 * Rows whose `CODLOCAL` is empty or a placeholder (all zeros) cannot be grouped
 * safely and get the fallback key `MOD-<codMod>`.
 *
 * Schools listed in `EXCLUDED_INSTITUTION_KEYS` are dropped from the output.
 */

/**
 * Institution keys deliberately removed from the platform.
 *
 * - `LOC-347708-CLARETIANO` (CLARETIANO, VILLA MARIA DEL TRIUNFO): removed for
 *   the demo (2026-09-13) so students only see one Claretiano, the demo school
 *   `LOC-337988-CLARETIANO` (SAN MIGUEL). Existing rows are removed by the
 *   migration `20260913180000_remove_duplicate_claretiano_vmt`.
 */
export const EXCLUDED_INSTITUTION_KEYS: readonly string[] = ["LOC-347708-CLARETIANO"];

export interface SchoolServiceRow {
  codInst: string;
  codMod: string;
  codLocal: string;
  cenEdu: string;
  level: string;
  address: string;
  district: string;
  businessName: string;
}

export interface SchoolSeed {
  institutionKey: string;
  cenEdu: string;
  district: string;
  address: string;
  businessName: string;
  levels: string[];
  codMods: string[];
}

export interface SchoolGroupingStats {
  totalRows: number;
  skippedRows: number;
  uniqueCodMods: number;
  schools: number;
  /** Service rows folded into another school (before exclusions). */
  mergedRows: number;
  /** Schools dropped because their key is in `EXCLUDED_INSTITUTION_KEYS`. */
  excludedSchools: number;
  fallbackKeys: number;
  /** CODLOCAL values hosting more than one normalized school name (kept apart). */
  codLocalWithMultipleNames: number;
  /** Non-empty CODINST values spread over several CODLOCAL values (kept apart). */
  codInstSpanningMultipleCodLocal: number;
  /** Merged schools whose services carry more than one non-empty CODINST. */
  schoolsWithMultipleCodInst: number;
}

export interface SchoolGroupingResult {
  schools: SchoolSeed[];
  stats: SchoolGroupingStats;
}

/** Upper-case, accent-free, punctuation-free, single-spaced name. */
export function normalizeSchoolName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function isPlaceholderCode(code: string): boolean {
  return code.length === 0 || /^0+$/.test(code);
}

function groupKeyFor(row: SchoolServiceRow): { key: string; fallback: boolean } {
  const codLocal = row.codLocal.trim();
  const name = normalizeSchoolName(row.cenEdu);
  if (isPlaceholderCode(codLocal) || name.length === 0) {
    return { key: `MOD-${row.codMod}`, fallback: true };
  }
  return { key: `LOC-${codLocal}-${name.replace(/ /g, "-")}`, fallback: false };
}

const firstNonEmpty = (values: string[]): string =>
  values.find((v) => v.trim().length > 0) ?? "";

export function groupSchoolServices(
  rows: SchoolServiceRow[],
): SchoolGroupingResult {
  let skippedRows = 0;
  const byCodMod = new Map<string, SchoolServiceRow>();

  for (const raw of rows) {
    const codMod = raw.codMod.trim();
    if (!codMod) {
      skippedRows++;
      continue;
    }
    byCodMod.set(codMod, { ...raw, codMod });
  }

  const services = [...byCodMod.values()];
  const groups = new Map<string, SchoolServiceRow[]>();
  let fallbackKeys = 0;

  for (const service of services) {
    const { key, fallback } = groupKeyFor(service);
    if (fallback) fallbackKeys++;
    const group = groups.get(key);
    if (group) group.push(service);
    else groups.set(key, [service]);
  }

  const excluded = new Set(EXCLUDED_INSTITUTION_KEYS);
  const schools: SchoolSeed[] = [...groups.entries()]
    .filter(([institutionKey]) => !excluded.has(institutionKey))
    .map(([institutionKey, members]) => {
      // Deterministic representative fields: lowest COD_MOD first.
      const ordered = [...members].sort((a, b) => a.codMod.localeCompare(b.codMod));
      return {
        institutionKey,
        cenEdu: firstNonEmpty(ordered.map((m) => m.cenEdu.trim())),
        district: firstNonEmpty(ordered.map((m) => m.district.trim())),
        address: firstNonEmpty(ordered.map((m) => m.address.trim())),
        businessName: firstNonEmpty(ordered.map((m) => m.businessName.trim())),
        levels: [...new Set(ordered.map((m) => m.level.trim()).filter(Boolean))].sort(),
        codMods: ordered.map((m) => m.codMod),
      };
    })
    .sort((a, b) => a.institutionKey.localeCompare(b.institutionKey));

  return {
    schools,
    stats: {
      totalRows: rows.length,
      skippedRows,
      uniqueCodMods: services.length,
      schools: schools.length,
      mergedRows: services.length - groups.size,
      excludedSchools: groups.size - schools.length,
      fallbackKeys,
      codLocalWithMultipleNames: countKeysWithManyValues(
        services,
        (s) => s.codLocal.trim(),
        (s) => normalizeSchoolName(s.cenEdu),
      ),
      codInstSpanningMultipleCodLocal: countKeysWithManyValues(
        services.filter((s) => !isPlaceholderCode(s.codInst.trim())),
        (s) => s.codInst.trim(),
        (s) => s.codLocal.trim(),
      ),
      schoolsWithMultipleCodInst: [...groups.values()].filter(
        (members) =>
          new Set(members.map((m) => m.codInst.trim()).filter((c) => !isPlaceholderCode(c)))
            .size > 1,
      ).length,
    },
  };
}

function countKeysWithManyValues<T>(
  items: T[],
  keyOf: (item: T) => string,
  valueOf: (item: T) => string,
): number {
  const values = new Map<string, Set<string>>();
  for (const item of items) {
    const key = keyOf(item);
    const set = values.get(key) ?? new Set<string>();
    set.add(valueOf(item));
    values.set(key, set);
  }
  return [...values.values()].filter((set) => set.size > 1).length;
}
