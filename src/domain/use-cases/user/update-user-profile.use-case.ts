import { CustomError } from "../../error/custom-error.js";
import { UpdateUserDto } from "../../dtos/user/update-user.dto.js";
import { UserEntity } from "../../entities/user.entity.js";
import { UserRepository } from "../../repositories/user.repository.js";

export class UpdateUserProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: number, dto: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound("User not found");

    return this.userRepository.update(id, dto);
  }
}
