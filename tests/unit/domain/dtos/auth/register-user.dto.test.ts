import { RegisterUserDto } from '../../../../../src/domain/dtos/auth/register-user.dto.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const base = {
  password: 'Password1',
  email: 'teacher@example.com',
  name: 'Teacher Name',
  birthDate: '1990-01-01',
  roleId: ROLES.TEACHER,
};

describe('RegisterUserDto.create', () => {
  it('creates valid teacher dto', () => {
    const [err, dto] = RegisterUserDto.create(base);
    expect(err).toBeUndefined();
    expect(dto!.email).toBe('teacher@example.com');
    expect(dto!.name).toBe('Teacher Name');
    expect(dto!.roleId).toBe(ROLES.TEACHER);
  });

  it('teacher starts inactive (isActive=false)', () => {
    const [, dto] = RegisterUserDto.create({ ...base, roleId: ROLES.TEACHER });
    expect(dto!.isActive).toBe(false);
  });

  it('student starts inactive (isActive=false)', () => {
    const [, dto] = RegisterUserDto.create({ ...base, roleId: ROLES.STUDENT });
    expect(dto!.isActive).toBe(false);
  });

  it('admin starts active (isActive=true)', () => {
    const [, dto] = RegisterUserDto.create({ ...base, roleId: ROLES.ADMIN });
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

  it('accepts optional schoolId', () => {
    const [err, dto] = RegisterUserDto.create({ ...base, schoolId: 5 });
    expect(err).toBeUndefined();
    expect(dto!.schoolId).toBe(5);
  });

  it('defaults phoneNumber to null when not provided', () => {
    const [, dto] = RegisterUserDto.create(base);
    expect(dto!.phoneNumber).toBeNull();
  });
});
