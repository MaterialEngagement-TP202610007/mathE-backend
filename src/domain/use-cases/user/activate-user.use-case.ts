import { CustomError } from "../../error/custom-error.js";
import { UserEntity } from "../../entities/user.entity.js";
import { UserRepository } from "../../repositories/user.repository.js";

export class ActivateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: number): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound("User not found");
    if (existing.deletedAt) {
      throw CustomError.badRequest("Cannot activate a deleted user");
    }
    if (existing.isActive) {
      throw CustomError.badRequest("User is already active");
    }

    return this.userRepository.setActive(id, true);
  }
}
