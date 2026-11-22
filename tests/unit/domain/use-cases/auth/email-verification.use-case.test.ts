import { SendEmailVerificationCodeUseCase } from '../../../../../src/domain/use-cases/auth/send-email-verification-code.use-case.js';
import { VerifyEmailUseCase } from '../../../../../src/domain/use-cases/auth/verify-email.use-case.js';
import { VerifyEmailDto } from '../../../../../src/domain/dtos/auth/verify-email.dto.js';
import { ResendVerificationDto } from '../../../../../src/domain/dtos/auth/resend-verification.dto.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import {
  EmailVerificationRepository,
  PendingVerificationCode,
} from '../../../../../src/domain/repositories/email-verification.repository.js';
import { EmailSenderAdapter } from '../../../../../src/domain/adapters/email-sender.adapter.js';
import { VerificationCodeAdapter } from '../../../../../src/domain/adapters/verification-code.adapter.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const NOW = new Date('2026-11-22T12:00:00Z');
const CONFIG = { codeTtlMinutes: 15, maxAttempts: 5, resendCooldownSeconds: 60, now: () => NOW };

function makeUser(emailVerifiedAt: Date | null = null): UserEntity {
  return new UserEntity(
    7, 'hashed', 'ana@example.com', 'Ana Pérez',
    new Date('2015-03-10'), new Date(), new Date(),
    null, true, ROLES.STUDENT, null, 5, null, 'SANTA URSULA', NOW, emailVerifiedAt,
  );
}

function makeUserRepo(user: UserEntity | null): jest.Mocked<UserRepository> {
  return {
    findByEmail: jest.fn().mockResolvedValue(user),
  } as unknown as jest.Mocked<UserRepository>;
}

function makeVerificationRepo(pending: PendingVerificationCode | null = null) {
  return {
    findByUserId: jest.fn().mockResolvedValue(pending),
    save: jest.fn().mockResolvedValue(undefined),
    incrementAttempts: jest.fn().mockResolvedValue(undefined),
    markVerified: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<EmailVerificationRepository>;
}

function makeCodeAdapter(): jest.Mocked<VerificationCodeAdapter> {
  return {
    generate: jest.fn().mockReturnValue('042917'),
    hash: jest.fn((code: string) => `hash:${code}`),
    matches: jest.fn((code: string, hash: string) => hash === `hash:${code}`),
  };
}

function makeEmailSender(): jest.Mocked<EmailSenderAdapter> {
  return { sendVerificationCode: jest.fn().mockResolvedValue(undefined) };
}

function pending(overrides: Partial<PendingVerificationCode> = {}): PendingVerificationCode {
  return {
    userId: 7,
    codeHash: 'hash:042917',
    expiresAt: new Date(NOW.getTime() + 10 * 60 * 1000),
    attempts: 0,
    createdAt: new Date(NOW.getTime() - 5 * 60 * 1000),
    ...overrides,
  };
}

describe('VerifyEmailDto.create', () => {
  it('normalizes the email and accepts a 6-digit code', () => {
    const [err, dto] = VerifyEmailDto.create({ email: '  Ana@Example.com ', code: ' 042917 ' });
    expect(err).toBeUndefined();
    expect(dto).toMatchObject({ email: 'ana@example.com', code: '042917' });
  });

  it.each([undefined, '', '12345', '1234567', 'abcdef', 42917])('rejects code %p', (code) => {
    const [err] = VerifyEmailDto.create({ email: 'ana@example.com', code });
    expect(err).toBe('Invalid verification code format');
  });

  it('rejects a missing or invalid email', () => {
    expect(VerifyEmailDto.create({ code: '042917' })[0]).toBe('Missing Email');
    expect(VerifyEmailDto.create({ email: 'ana@', code: '042917' })[0]).toBe('Invalid Email');
  });
});

describe('ResendVerificationDto.create', () => {
  it('normalizes the email', () => {
    const [err, dto] = ResendVerificationDto.create({ email: 'ANA@example.com' });
    expect(err).toBeUndefined();
    expect(dto!.email).toBe('ana@example.com');
  });

  it('rejects a missing email', () => {
    expect(ResendVerificationDto.create({})[0]).toBe('Missing Email');
  });
});

describe('SendEmailVerificationCodeUseCase', () => {
  it('stores only the hash with a 15-minute expiry and emails the plain code', async () => {
    const repo = makeVerificationRepo();
    const sender = makeEmailSender();
    const useCase = new SendEmailVerificationCodeUseCase(
      makeUserRepo(makeUser()), repo, makeCodeAdapter(), sender, CONFIG,
    );

    await useCase.sendTo(makeUser());

    expect(repo.save).toHaveBeenCalledWith({
      userId: 7,
      codeHash: 'hash:042917',
      expiresAt: new Date('2026-11-22T12:15:00Z'),
      createdAt: NOW,
    });
    expect(sender.sendVerificationCode).toHaveBeenCalledWith({
      to: 'ana@example.com',
      name: 'Ana Pérez',
      code: '042917',
      expiresInMinutes: 15,
    });
  });

  it('resend does nothing for an unknown email (no account enumeration)', async () => {
    const repo = makeVerificationRepo();
    const sender = makeEmailSender();
    const useCase = new SendEmailVerificationCodeUseCase(
      makeUserRepo(null), repo, makeCodeAdapter(), sender, CONFIG,
    );

    await expect(useCase.execute(ResendVerificationDto.create({ email: 'x@example.com' })[1]!)).resolves.toBeUndefined();
    expect(repo.save).not.toHaveBeenCalled();
    expect(sender.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('resend does nothing when the email is already verified', async () => {
    const sender = makeEmailSender();
    const useCase = new SendEmailVerificationCodeUseCase(
      makeUserRepo(makeUser(NOW)), makeVerificationRepo(), makeCodeAdapter(), sender, CONFIG,
    );

    await useCase.execute(ResendVerificationDto.create({ email: 'ana@example.com' })[1]!);
    expect(sender.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('resend inside the 60-second cooldown answers 429 without sending', async () => {
    const sender = makeEmailSender();
    const repo = makeVerificationRepo(pending({ createdAt: new Date(NOW.getTime() - 20 * 1000) }));
    const useCase = new SendEmailVerificationCodeUseCase(
      makeUserRepo(makeUser()), repo, makeCodeAdapter(), sender, CONFIG,
    );

    const error = await useCase
      .execute(ResendVerificationDto.create({ email: 'ana@example.com' })[1]!)
      .catch((e: unknown) => e as CustomError);

    expect(error).toBeInstanceOf(CustomError);
    expect(error).toMatchObject({
      statusCode: 429,
      message: 'Please wait 40 seconds before requesting a new code',
    });
    expect(sender.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('resend after the cooldown replaces the code and sends it', async () => {
    const sender = makeEmailSender();
    const repo = makeVerificationRepo(pending());
    const useCase = new SendEmailVerificationCodeUseCase(
      makeUserRepo(makeUser()), repo, makeCodeAdapter(), sender, CONFIG,
    );

    await useCase.execute(ResendVerificationDto.create({ email: 'ana@example.com' })[1]!);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(sender.sendVerificationCode).toHaveBeenCalledTimes(1);
  });
});

describe('VerifyEmailUseCase', () => {
  const dto = (code = '042917') => VerifyEmailDto.create({ email: 'ana@example.com', code })[1]!;

  it('marks the email verified when the code matches', async () => {
    const repo = makeVerificationRepo(pending());
    const useCase = new VerifyEmailUseCase(makeUserRepo(makeUser()), repo, makeCodeAdapter(), CONFIG);

    await useCase.execute(dto());

    expect(repo.markVerified).toHaveBeenCalledWith(7, NOW);
  });

  it('a wrong code counts one attempt and answers 400', async () => {
    const repo = makeVerificationRepo(pending());
    const useCase = new VerifyEmailUseCase(makeUserRepo(makeUser()), repo, makeCodeAdapter(), CONFIG);

    await expect(useCase.execute(dto('111111'))).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired verification code',
    });
    expect(repo.incrementAttempts).toHaveBeenCalledWith(7);
    expect(repo.markVerified).not.toHaveBeenCalled();
  });

  it('an expired code answers 400 even when it matches', async () => {
    const repo = makeVerificationRepo(pending({ expiresAt: new Date(NOW.getTime() - 1) }));
    const useCase = new VerifyEmailUseCase(makeUserRepo(makeUser()), repo, makeCodeAdapter(), CONFIG);

    await expect(useCase.execute(dto())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired verification code',
    });
    expect(repo.markVerified).not.toHaveBeenCalled();
  });

  it('after 5 failed attempts even the right code is refused with 429', async () => {
    const repo = makeVerificationRepo(pending({ attempts: 5 }));
    const useCase = new VerifyEmailUseCase(makeUserRepo(makeUser()), repo, makeCodeAdapter(), CONFIG);

    await expect(useCase.execute(dto())).rejects.toMatchObject({
      statusCode: 429,
      message: 'Too many failed attempts. Request a new verification code',
    });
    expect(repo.markVerified).not.toHaveBeenCalled();
  });

  it('answers the same 400 for an unknown email or a missing code', async () => {
    const noUser = new VerifyEmailUseCase(makeUserRepo(null), makeVerificationRepo(), makeCodeAdapter(), CONFIG);
    const noCode = new VerifyEmailUseCase(makeUserRepo(makeUser()), makeVerificationRepo(null), makeCodeAdapter(), CONFIG);

    for (const useCase of [noUser, noCode]) {
      await expect(useCase.execute(dto())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired verification code',
      });
    }
  });

  it('is a no-op success when the email is already verified', async () => {
    const repo = makeVerificationRepo(null);
    const useCase = new VerifyEmailUseCase(makeUserRepo(makeUser(NOW)), repo, makeCodeAdapter(), CONFIG);

    await expect(useCase.execute(dto())).resolves.toBeUndefined();
    expect(repo.markVerified).not.toHaveBeenCalled();
  });
});
