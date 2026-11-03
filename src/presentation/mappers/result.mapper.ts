import { ROLES } from "../../domain/constants/roles.constant.js";
import { ResultEntity } from "../../domain/entities/result.entity.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

/** Result as a student sees it: no HU-44 label-correction audit. */
export type StudentResult = Omit<
  ResultEntity,
  "correctedVakLabel" | "correctedAt" | "correctedBy"
>;

/**
 * HU-44: the label correction (`correctedVakLabel`, `correctedAt`,
 * `correctedBy`) is pilot ground truth for teachers. Students keep the
 * classifier output they always received.
 */
export function toResultResponse(
  result: ResultEntity,
  roleId: number | null | undefined,
): ResultEntity | StudentResult {
  if (roleId !== ROLES.STUDENT) return result;
  const {
    correctedVakLabel: _label,
    correctedAt: _at,
    correctedBy: _by,
    ...studentView
  } = result;
  return studentView;
}

export function toResultPageResponse(
  page: PaginatedResult<ResultEntity>,
  roleId: number | null | undefined,
): PaginatedResult<ResultEntity | StudentResult> {
  return {
    ...page,
    items: page.items.map((item) => toResultResponse(item, roleId)),
  };
}
