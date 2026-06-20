export class ListUsersDto {
  private constructor(
    public readonly isActive?: boolean,
    public readonly academicGradeId?: number,
    public readonly birthDateFrom?: Date,
    public readonly birthDateTo?: Date,
    public readonly createdAtFrom?: Date,
    public readonly createdAtTo?: Date,
  ) {}

  static create(query: Record<string, any>): [string?, ListUsersDto?] {
    let isActive: boolean | undefined;
    let academicGradeId: number | undefined;
    let birthDateFrom: Date | undefined;
    let birthDateTo: Date | undefined;
    let createdAtFrom: Date | undefined;
    let createdAtTo: Date | undefined;

    if (query.isActive !== undefined) {
      if (query.isActive !== "true" && query.isActive !== "false") {
        return ['isActive must be "true" or "false"'];
      }
      isActive = query.isActive === "true";
    }

    if (query.academicGradeId !== undefined) {
      const parsed = Number(query.academicGradeId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return ["academicGradeId must be a positive integer"];
      }
      academicGradeId = parsed;
    }

    if (query.birthDateFrom !== undefined) {
      const d = new Date(query.birthDateFrom);
      if (isNaN(d.getTime())) return ["birthDateFrom is not a valid date"];
      birthDateFrom = d;
    }

    if (query.birthDateTo !== undefined) {
      const d = new Date(query.birthDateTo);
      if (isNaN(d.getTime())) return ["birthDateTo is not a valid date"];
      birthDateTo = d;
    }

    if (birthDateFrom && birthDateTo && birthDateFrom > birthDateTo) {
      return ["birthDateFrom must be before birthDateTo"];
    }

    if (query.createdAtFrom !== undefined) {
      const d = new Date(query.createdAtFrom);
      if (isNaN(d.getTime())) return ["createdAtFrom is not a valid date"];
      createdAtFrom = d;
    }

    if (query.createdAtTo !== undefined) {
      const d = new Date(query.createdAtTo);
      if (isNaN(d.getTime())) return ["createdAtTo is not a valid date"];
      createdAtTo = d;
    }

    if (createdAtFrom && createdAtTo && createdAtFrom > createdAtTo) {
      return ["createdAtFrom must be before createdAtTo"];
    }

    return [
      undefined,
      new ListUsersDto(
        isActive,
        academicGradeId,
        birthDateFrom,
        birthDateTo,
        createdAtFrom,
        createdAtTo,
      ),
    ];
  }
}
