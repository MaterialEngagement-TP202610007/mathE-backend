import { prisma } from "../../config/database/index.js";
import { SchoolRepository } from "../../domain/repositories/school.repository.js";
import { SchoolEntity } from "../../domain/entities/school.entity.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { SchoolListFilters } from "../../domain/interfaces/school/index.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

const insensitiveContains = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? { contains: trimmed, mode: "insensitive" as const } : undefined;
};

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
    const cenEdu = insensitiveContains(filters.search);
    const district = insensitiveContains(filters.district);
    const where = {
      ...(cenEdu && { cenEdu }),
      ...(district && { district }),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.school.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Homonymous schools stay distinguishable (and paging stable) by district/id.
        orderBy: [{ cenEdu: "asc" }, { district: "asc" }, { id: "asc" }],
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
