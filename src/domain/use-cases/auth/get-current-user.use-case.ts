import { CustomError } from "../../error/custom-error.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { UserEntity } from "../../entities/user.entity.js";

/**
 * Validates the current session: given the id decoded from the auth cookie,
 * re-fetches the user from the DB so a deleted/deactivated account is rejected
 * even while its JWT is still cryptographically valid.
 */
export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: number): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId);
    // Unauthorized (not 404) — the session is no longer valid.
    if (!user) throw CustomError.unauthorized("Invalid session");
    if (!user.isActive) throw CustomError.unauthorized("Account is inactive");

    return user;
  }
}
