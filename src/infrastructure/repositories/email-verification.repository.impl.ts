import { prisma } from "../../config/database/index.js";
import {
  EmailVerificationRepository,
  PendingVerificationCode,
} from "../../domain/repositories/email-verification.repository.js";

export class EmailVerificationRepositoryImpl implements EmailVerificationRepository {
  async findByUserId(userId: number): Promise<PendingVerificationCode | null> {
    const row = await prisma.emailVerificationCode.findUnique({ where: { userId } });
    if (!row) return null;
    return {
      userId: row.userId,
      codeHash: row.codeHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      createdAt: row.createdAt,
    };
  }

  async save(code: Omit<PendingVerificationCode, "attempts">): Promise<void> {
    await prisma.emailVerificationCode.upsert({
      where: { userId: code.userId },
      create: { ...code, attempts: 0 },
      update: {
        codeHash: code.codeHash,
        expiresAt: code.expiresAt,
        createdAt: code.createdAt,
        attempts: 0,
      },
    });
  }

  async incrementAttempts(userId: number): Promise<void> {
    await prisma.emailVerificationCode.update({
      where: { userId },
      data: { attempts: { increment: 1 } },
    });
  }

  async markVerified(userId: number, verifiedAt: Date): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: verifiedAt } }),
      prisma.emailVerificationCode.deleteMany({ where: { userId } }),
    ]);
  }
}
