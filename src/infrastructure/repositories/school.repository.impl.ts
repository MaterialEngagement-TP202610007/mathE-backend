import { prisma } from "../../config/database/index.js";
import { SchoolRepository } from "../../domain/repositories/school.repository.js";
import { SchoolEntity } from "../../domain/entities/school.entity.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { SchoolListFilters } from "../../domain/interfaces/school/index.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

export class SchoolRepositoryImpl implements SchoolRepository {
  async findById(id: number): Promise<SchoolEntity | null> {
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) return null;
    return SchoolEntity.fromObject(school);
  }

  async findAll(
    pagination: PaginationDto,
    filters: SchoolListFilters = {},
  ): Promise<PaginatedResult<SchoolEntity>> {
    const where = {
      ...(filters.search && filters.search.trim().length > 0
        ? {
            cenEdu: {
              contains: filters.search.trim(),
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.school.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { cenEdu: "asc" },
      }),
      prisma.school.count({ where }),
    ]);

    return {
      items: rows.map((row) => SchoolEntity.fromObject(row)),
      total,
      page,
      limit,
    };
  }
}
