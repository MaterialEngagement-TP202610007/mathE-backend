import type { PrismaClient } from "../../generated/prisma/client.js";
import { AdminBootstrapRepository } from "../../domain/repositories/admin-bootstrap.repository.js";
import {
  CreateAdminData,
  PromoteToAdminData,
} from "../../domain/interfaces/user/index.js";

/**
 * Receives its Prisma client instead of importing the app singleton, so the
 * seed / bootstrap scripts can run it with their own connection.
 */
export class AdminBootstrapRepositoryImpl implements AdminBootstrapRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string): Promise<{ id: number } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  createAdmin(data: CreateAdminData): Promise<{ id: number }> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: data.passwordHash,
        roleId: data.roleId,
        birthDate: data.birthDate,
        isActive: true,
        phoneNumber: null,
        academicGradeId: null,
        schoolId: null,
      },
      select: { id: true },
    });
  }

  promoteToAdmin(id: number, data: PromoteToAdminData): Promise<{ id: number }> {
    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        roleId: data.roleId,
        isActive: true,
        deletedAt: null,
        ...(data.passwordHash !== undefined && { password: data.passwordHash }),
      },
      select: { id: true },
    });
  }
}
