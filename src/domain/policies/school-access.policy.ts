import { ROLES } from "../constants/roles.constant.js";
import { CustomError } from "../error/custom-error.js";
import { Requester } from "../interfaces/shared/requester.interface.js";
import { UserRepository } from "../repositories/user.repository.js";

/**
 * School-scoped authorization. Admins may act on any school; teachers only on
 * their own. The teacher's school is always loaded from the repository — the
 * JWT carries no school, and a stale token must not grant access.
 */
export class SchoolAccessPolicy {
  constructor(private readonly userRepository: UserRepository) {}

  async assertCanAccessSchool(
    requester: Requester,
    schoolId: number,
  ): Promise<void> {
    if (requester.roleId === ROLES.ADMIN) return;

    const ownSchoolId = await this.teacherSchoolId(requester);
    if (ownSchoolId === null || ownSchoolId !== schoolId) {
      throw CustomError.forbidden("You can only access data from your own school");
    }
  }

  async assertCanManageQuestion(
    requester: Requester,
    question: { schoolId: number | null },
  ): Promise<void> {
    if (requester.roleId === ROLES.ADMIN) return;

    const ownSchoolId = await this.teacherSchoolId(requester);
    if (ownSchoolId === null || question.schoolId !== ownSchoolId) {
      throw CustomError.forbidden("Question does not belong to your school");
    }
  }

  /** School of an active teacher requester, or null when not applicable. */
  private async teacherSchoolId(requester: Requester): Promise<number | null> {
    if (requester.roleId !== ROLES.TEACHER) return null;
    const teacher = await this.userRepository.findById(requester.id);
    if (!teacher || teacher.deletedAt !== null) return null;
    return teacher.schoolId;
  }
}
