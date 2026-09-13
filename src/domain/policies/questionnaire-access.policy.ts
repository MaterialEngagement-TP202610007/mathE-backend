import { ROLES } from "../constants/roles.constant.js";
import { QuestionnaireEntity } from "../entities/questionnaire.entity.js";
import { CustomError } from "../error/custom-error.js";
import { Requester } from "../interfaces/shared/requester.interface.js";

const STAFF_ROLES: ReadonlyArray<number> = [ROLES.TEACHER, ROLES.ADMIN];

/** Teachers and admins may read any questionnaire; anyone else only their own. */
export function assertCanReadQuestionnaire(
  questionnaire: QuestionnaireEntity,
  requester: Requester,
): void {
  const isStaff =
    requester.roleId !== null && STAFF_ROLES.includes(requester.roleId);
  if (!isStaff && questionnaire.studentId !== requester.id) {
    throw CustomError.forbidden("Questionnaire does not belong to you");
  }
}

/** Only the owning student may modify a questionnaire. */
export function assertOwnsQuestionnaire(
  questionnaire: QuestionnaireEntity,
  studentId: number,
): void {
  if (questionnaire.studentId !== studentId) {
    throw CustomError.forbidden("Questionnaire does not belong to you");
  }
}
