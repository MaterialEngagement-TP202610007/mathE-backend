import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import { UserEntity } from "../../entities/user.entity.js";
import { UserRepository } from "../../repositories/user.repository.js";

export class DeleteUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: number, callerRoleId?: number): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound("User not found");
    if (existing.deletedAt) throw CustomError.badRequest("User already deleted");

    if (callerRoleId === ROLES.TEACHER && existing.roleId !== ROLES.STUDENT) {
      throw CustomError.forbidden("Teachers can only deactivate students");
    }

    return this.userRepository.softDelete(id);
  }
}
