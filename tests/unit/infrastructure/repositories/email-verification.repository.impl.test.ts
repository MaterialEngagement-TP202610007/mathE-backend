jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    emailVerificationCode: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { EmailVerificationRepositoryImpl } from '../../../../src/infrastructure/repositories/email-verification.repository.impl.js';

const mocked = prisma as unknown as {
  emailVerificationCode: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock; deleteMany: jest.Mock };
  user: { update: jest.Mock };
  $transaction: jest.Mock;
};

describe('EmailVerificationRepositoryImpl', () => {
  const repo = new EmailVerificationRepositoryImpl();
  const code = {
    userId: 7,
    codeHash: 'h'.repeat(64),
    expiresAt: new Date('2026-11-22T12:15:00Z'),
    createdAt: new Date('2026-11-22T12:00:00Z'),
  };

  it('save replaces the previous code and resets attempts', async () => {
    await repo.save(code);

    expect(mocked.emailVerificationCode.upsert).toHaveBeenCalledWith({
      where: { userId: 7 },
      create: { ...code, attempts: 0 },
      update: { codeHash: code.codeHash, expiresAt: code.expiresAt, createdAt: code.createdAt, attempts: 0 },
    });
  });

  it('incrementAttempts adds one atomically', async () => {
    await repo.incrementAttempts(7);

    expect(mocked.emailVerificationCode.update).toHaveBeenCalledWith({
      where: { userId: 7 },
      data: { attempts: { increment: 1 } },
    });
  });

  it('markVerified sets emailVerifiedAt and removes the code in one transaction', async () => {
    const verifiedAt = new Date('2026-11-22T12:05:00Z');
    mocked.user.update.mockReturnValueOnce('user-op');
    mocked.emailVerificationCode.deleteMany.mockReturnValueOnce('delete-op');

    await repo.markVerified(7, verifiedAt);

    expect(mocked.user.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { emailVerifiedAt: verifiedAt } });
    expect(mocked.emailVerificationCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(mocked.$transaction).toHaveBeenCalledWith(['user-op', 'delete-op']);
  });

  it('findByUserId maps the row or returns null', async () => {
    mocked.emailVerificationCode.findUnique.mockResolvedValueOnce({ id: 1, attempts: 2, ...code });
    await expect(repo.findByUserId(7)).resolves.toEqual({ ...code, attempts: 2 });

    mocked.emailVerificationCode.findUnique.mockResolvedValueOnce(null);
    await expect(repo.findByUserId(7)).resolves.toBeNull();
  });
});
