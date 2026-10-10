export interface UserListFilters {
  roleId?: number;
  schoolId?: number;
  isActive?: boolean;
  academicGradeId?: number;
  birthDateFrom?: Date;
  birthDateTo?: Date;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  /**
   * HU-37: case-insensitive partial match on name or email, plus an exact id
   * match when the term is a positive integer.
   */
  search?: string;
}

export interface CreateAdminData {
  email: string;
  name: string;
  passwordHash: string;
  roleId: number;
  birthDate: Date;
}

export interface PromoteToAdminData {
  name: string;
  roleId: number;
  /** Only set when the password must be replaced. */
  passwordHash?: string;
}

export interface BootstrapAdminResult {
  userId: number;
  created: boolean;
  passwordUpdated: boolean;
}