import { ReportPeriod } from "../../interfaces/result/index.js";

export const REPORT_PERIODS = ["week", "month", "quarter", "year"] as const;
export type ReportPeriodName = (typeof REPORT_PERIODS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(raw: unknown): Date | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const date = new Date(String(raw));
  return isNaN(date.getTime()) ? null : date;
}

/** Start of a relative period ending at `now` (UTC calendar arithmetic). */
function periodStart(period: ReportPeriodName, now: Date): Date {
  const start = new Date(now.getTime());
  switch (period) {
    case "week":
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case "month":
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
    case "quarter":
      start.setUTCMonth(start.getUTCMonth() - 3);
      break;
    case "year":
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      break;
  }
  return start;
}

/**
 * HU-51 report time range, from query params.
 *
 * - `period=week|month|quarter|year` is a shortcut for the range ending at
 *   `now` (the injected clock) and starting one week/month/3 months/year before.
 * - `from` / `to` are ISO dates or timestamps. A date-only `to` (`YYYY-MM-DD`)
 *   is inclusive (23:59:59.999 UTC). When sent together with `period`, an
 *   explicit bound overrides the period's bound.
 * - No params → open range (every result, the pre-HU-51 behaviour).
 */
export class ReportPeriodDto implements ReportPeriod {
  private constructor(
    public readonly from: Date | undefined,
    public readonly to: Date | undefined,
  ) {}

  static create(
    query: { [key: string]: any },
    now: Date = new Date(),
  ): [string?, ReportPeriodDto?] {
    let from: Date | undefined;
    let to: Date | undefined;

    if (query.period !== undefined && query.period !== "") {
      const period = String(query.period) as ReportPeriodName;
      if (!REPORT_PERIODS.includes(period)) {
        return [`period must be one of: ${REPORT_PERIODS.join(", ")}`];
      }
      from = periodStart(period, now);
      to = new Date(now.getTime());
    }

    const explicitFrom = parseDate(query.from);
    if (explicitFrom === null) return ["Invalid from date"];
    const explicitTo = parseDate(query.to);
    if (explicitTo === null) return ["Invalid to date"];
    if (explicitTo && DATE_ONLY.test(String(query.to))) {
      explicitTo.setUTCHours(23, 59, 59, 999);
    }

    from = explicitFrom ?? from;
    to = explicitTo ?? to;
    if (from && to && from > to) return ["from must be before or equal to to"];

    return [undefined, new ReportPeriodDto(from, to)];
  }
}
