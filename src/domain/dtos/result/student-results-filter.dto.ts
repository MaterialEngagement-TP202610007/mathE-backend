import { StudentResultFilters } from "../../interfaces/result/index.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(raw: unknown): Date | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const date = new Date(String(raw));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Query filters for a student's result history. A date-only `endDate`
 * (`YYYY-MM-DD`) is inclusive: it is moved to 23:59:59.999 UTC of that day.
 */
export class StudentResultsFilterDto implements StudentResultFilters {
  private constructor(
    public readonly startDate: Date | undefined,
    public readonly endDate: Date | undefined,
    public readonly predominantStyle: string | undefined,
    public readonly classifierType: string | undefined,
  ) {}

  static create(
    query: { [key: string]: any },
  ): [string?, StudentResultsFilterDto?] {
    const startDate = parseDate(query.startDate);
    if (startDate === null) return ["Invalid startDate"];

    const endDate = parseDate(query.endDate);
    if (endDate === null) return ["Invalid endDate"];
    if (endDate && DATE_ONLY.test(String(query.endDate))) {
      endDate.setUTCHours(23, 59, 59, 999);
    }

    const predominantStyle = query.predominantStyle
      ? String(query.predominantStyle)
      : undefined;
    const classifierType = query.classifierType
      ? String(query.classifierType)
      : undefined;

    return [
      undefined,
      new StudentResultsFilterDto(
        startDate,
        endDate,
        predominantStyle,
        classifierType,
      ),
    ];
  }
}
