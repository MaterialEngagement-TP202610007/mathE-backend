import { CustomError } from "../../error/custom-error.js";
import { SchoolEntity } from "../../entities/school.entity.js";
import { SchoolRepository } from "../../repositories/school.repository.js";

export class GetSchoolUseCase {
  constructor(private readonly schoolRepository: SchoolRepository) {}

  async execute(id: number): Promise<SchoolEntity> {
    const school = await this.schoolRepository.findById(id);
    if (!school) throw CustomError.notFound("School not found");
    return school;
  }
}
