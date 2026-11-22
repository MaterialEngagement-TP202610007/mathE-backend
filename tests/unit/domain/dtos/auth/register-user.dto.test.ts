import { RegisterUserDto } from '../../../../../src/domain/dtos/auth/register-user.dto.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const base = {
  password: 'Password1',
  email: 'teacher@example.com',
  name: 'Teacher Name',
  birthDate: '1990-01-01',
  roleId: ROLES.TEACHER,
  schoolId: 5,
  acceptTerms: true,
};

describe('RegisterUserDto.create', () => {
  it('creates valid teacher dto', () => {
    const [err, dto] = RegisterUserDto.create(base);
    expect(err).toBeUndefined();
    expect(dto!.email).toBe('teacher@example.com');
    expect(dto!.name).toBe('Teacher Name');
    expect(dto!.roleId).toBe(ROLES.TEACHER);
  });

  it('teacher starts inactive until an admin approves it (isActive=false)', () => {
    const [, dto] = RegisterUserDto.create({ ...base, roleId: ROLES.TEACHER });
    expect(dto!.isActive).toBe(false);
  });

  it('student is active immediately (isActive=true)', () => {
    const [, dto] = RegisterUserDto.create({ ...base, roleId: ROLES.STUDENT, birthDate: '2015-03-10' });
    expect(dto!.isActive).toBe(true);
  });

  it('rejects admin roleId (public registration cannot create admins)', () => {
    const [err, dto] = RegisterUserDto.create({ ...base, roleId: ROLES.ADMIN });
    expect(err).toBe('Invalid Role Id');
    expect(dto).toBeUndefined();
  });

  it('rejects unknown roleId', () => {
    const [err] = RegisterUserDto.create({ ...base, roleId: 99 });
    expect(err).toBe('Invalid Role Id');
  });

  it('rejects non-numeric roleId', () => {
    const [err] = RegisterUserDto.create({ ...base, roleId: 'abc' });
    expect(err).toBe('Invalid Role Id');
  });

  it('accepts numeric string roleId for student', () => {
    const [err, dto] = RegisterUserDto.create({ ...base, roleId: String(ROLES.STUDENT), birthDate: '2015-03-10' });
    expect(err).toBeUndefined();
    expect(dto!.roleId).toBe(ROLES.STUDENT);
    expect(dto!.isActive).toBe(true);
  });

  it('rejects missing password', () => {
    const [err] = RegisterUserDto.create({ ...base, password: undefined });
    expect(err).toBe('Missing Password');
  });

  it('rejects weak password (no number)', () => {
    const [err] = RegisterUserDto.create({ ...base, password: 'WeakPass' });
    expect(err).toBeDefined();
  });

  it('rejects password too short', () => {
    const [err] = RegisterUserDto.create({ ...base, password: 'Ab1' });
    expect(err).toBeDefined();
  });

  it('rejects missing email', () => {
    const [err] = RegisterUserDto.create({ ...base, email: undefined });
    expect(err).toBe('Missing Email');
  });

  it('rejects invalid email', () => {
    const [err] = RegisterUserDto.create({ ...base, email: 'not-an-email' });
    expect(err).toBeDefined();
  });

  it('rejects missing name', () => {
    const [err] = RegisterUserDto.create({ ...base, name: undefined });
    expect(err).toBe('Missing Name');
  });

  it('rejects missing birthDate', () => {
    const [err] = RegisterUserDto.create({ ...base, birthDate: undefined });
    expect(err).toBe('Missing Birth Date');
  });

  it('rejects invalid birthDate', () => {
    const [err] = RegisterUserDto.create({ ...base, birthDate: 'not-a-date' });
    expect(err).toBe('Invalid Birth Date');
  });

  it('rejects missing roleId', () => {
    const [err] = RegisterUserDto.create({ ...base, roleId: undefined });
    expect(err).toBe('Missing Role Id');
  });

  it('accepts optional phoneNumber', () => {
    const [err, dto] = RegisterUserDto.create({ ...base, phoneNumber: '+51987654321' });
    expect(err).toBeUndefined();
    expect(dto!.phoneNumber).toBe('+51987654321');
  });

  it('rejects invalid phoneNumber', () => {
    const [err] = RegisterUserDto.create({ ...base, phoneNumber: 'abc' });
    expect(err).toBe('Invalid Phone Number');
  });

  it('accepts schoolId', () => {
    const [err, dto] = RegisterUserDto.create({ ...base, schoolId: 5 });
    expect(err).toBeUndefined();
    expect(dto!.schoolId).toBe(5);
  });

  it('accepts a numeric string schoolId', () => {
    const [err, dto] = RegisterUserDto.create({ ...base, schoolId: '7' });
    expect(err).toBeUndefined();
    expect(dto!.schoolId).toBe(7);
  });

  it.each([ROLES.STUDENT, ROLES.TEACHER])('requires schoolId for role %s', (roleId) => {
    for (const schoolId of [undefined, null, '']) {
      const [err, dto] = RegisterUserDto.create({ ...base, roleId, schoolId });
      expect(err).toBe('Missing School Id');
      expect(dto).toBeUndefined();
    }
  });

  it.each([0, -3, 1.5, 'abc'])('rejects non positive-integer schoolId %p', (schoolId) => {
    const [err] = RegisterUserDto.create({ ...base, schoolId });
    expect(err).toBe('Invalid School Id');
  });

  it.each([undefined, null, false, 'true', 1, 'yes'])(
    'rejects registration when acceptTerms is %p (must be exactly true)',
    (acceptTerms) => {
      const [err, dto] = RegisterUserDto.create({ ...base, acceptTerms });
      expect(err).toBe('Terms and privacy policy must be accepted');
      expect(dto).toBeUndefined();
    },
  );

  it('does not carry the acceptTerms flag; termsAcceptedAt is left for the use case', () => {
    const [err, dto] = RegisterUserDto.create(base);
    expect(err).toBeUndefined();
    expect(dto).not.toHaveProperty('acceptTerms');
    expect(dto!.termsAcceptedAt).toBeNull();
  });

  it('defaults phoneNumber to null when not provided', () => {
    const [, dto] = RegisterUserDto.create(base);
    expect(dto!.phoneNumber).toBeNull();
  });
});

describe('RegisterUserDto.create — personal data rules (TP2 CP017/CP018)', () => {
  const NOW = new Date('2026-11-22T12:00:00Z');
  const student = { ...base, roleId: ROLES.STUDENT, birthDate: '2015-03-10' };

  it.each(['x', 'xx', 'Ana', 'Ana B', 'Ana123 Pérez', 'Ana_ Pérez', '   '])(
    'rejects name %p (needs first name and last name, letters only)',
    (name) => {
      const [err, dto] = RegisterUserDto.create({ ...base, name }, NOW);
      expect(err).toBe('Invalid Name');
      expect(dto).toBeUndefined();
    },
  );

  it.each(['Ana Pérez', 'María José Núñez-Ríos', "Liam O'Connor", 'Juan de la Cruz'])(
    'accepts name %p',
    (name) => {
      const [err, dto] = RegisterUserDto.create({ ...base, name }, NOW);
      expect(err).toBeUndefined();
      expect(dto!.name).toBe(name);
    },
  );

  it('trims and collapses spaces in the stored name', () => {
    const [, dto] = RegisterUserDto.create({ ...base, name: '  Ana    Pérez ' }, NOW);
    expect(dto!.name).toBe('Ana Pérez');
  });

  it('rejects a birth date in the future', () => {
    const [err] = RegisterUserDto.create({ ...student, birthDate: '2026-12-01' }, NOW);
    expect(err).toBe('Invalid Birth Date');
  });

  it.each([
    ['2022-01-01', 'younger than 5'],
    ['2005-01-01', 'older than 20'],
  ])('rejects student birth date %s (%s)', (birthDate) => {
    const [err, dto] = RegisterUserDto.create({ ...student, birthDate }, NOW);
    expect(err).toBe('Birth date out of range for a student (5 to 20 years old)');
    expect(dto).toBeUndefined();
  });

  it.each(['2021-11-22', '2006-11-23'])('accepts student birth date %s (age bounds 5 and 20)', (birthDate) => {
    const [err] = RegisterUserDto.create({ ...student, birthDate }, NOW);
    expect(err).toBeUndefined();
  });

  it.each([
    ['2009-01-01', 'younger than 18'],
    ['1920-01-01', 'older than 100'],
  ])('rejects teacher birth date %s (%s)', (birthDate) => {
    const [err] = RegisterUserDto.create({ ...base, birthDate }, NOW);
    expect(err).toBe('Birth date out of range for a teacher (18 to 100 years old)');
  });

  it('accepts a teacher who turns 18 today', () => {
    const [err] = RegisterUserDto.create({ ...base, birthDate: '2008-11-22' }, NOW);
    expect(err).toBeUndefined();
  });

  it('normalizes the email (trim + lowercase) so case variants cannot duplicate an account', () => {
    const [err, dto] = RegisterUserDto.create({ ...base, email: ' Teacher@Example.com ' }, NOW);
    expect(err).toBeUndefined();
    expect(dto!.email).toBe('teacher@example.com');
  });

  it('new accounts start with an unverified email', () => {
    const [, dto] = RegisterUserDto.create(base, NOW);
    expect(dto!.emailVerifiedAt).toBeNull();
  });
});
