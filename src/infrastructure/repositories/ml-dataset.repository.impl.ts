import { prisma } from "../../config/database/index.js";
import { MLDatasetRepository } from "../../domain/repositories/ml-dataset.repository.js";
import { MLDatasetEntity } from "../../domain/entities/ml-dataset.entity.js";
import { MLDatasetListFilters } from "../../domain/interfaces/ml-dataset/index.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

export class MLDatasetRepositoryImpl implements MLDatasetRepository {
  async findAll(
    pagination: PaginationDto,
    filters: MLDatasetListFilters = {},
  ): Promise<PaginatedResult<MLDatasetEntity>> {
    const where = {
      ...(filters.studentId !== undefined && { studentId: filters.studentId }),
      ...(filters.includedInTraining !== undefined && {
        includedInTraining: filters.includedInTraining,
      }),
      ...(filters.labelSource !== undefined && {
        labelSource: filters.labelSource,
      }),
      ...(filters.gradeId !== undefined && {
        student: { academicGradeId: filters.gradeId },
      }),
      ...(filters.schoolId !== undefined && {
        student: { schoolId: filters.schoolId },
      }),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.mLDataset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.mLDataset.count({ where }),
    ]);

    return {
      items: rows.map(MLDatasetEntity.fromObject),
      total,
      page,
      limit,
    };
  }

  async findById(id: number): Promise<MLDatasetEntity | null> {
    const entry = await prisma.mLDataset.findUnique({ where: { id } });
    return entry ? MLDatasetEntity.fromObject(entry) : null;
  }
}
