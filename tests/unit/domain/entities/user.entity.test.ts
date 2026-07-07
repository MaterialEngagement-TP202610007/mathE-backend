import { UserEntity } from '../../../../src/domain/entities/user.entity.js';
import { CustomError } from '../../../../src/domain/error/custom-error.js';

const base = {
  id: 1,
  password: 'hashed',
  email: 'test@example.com',
  name: 'Test User',
  birthDate: new Date('2000-01-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  phoneNumber: null,
  isActive: true,
  roleId: 2,
  academicGradeId: null,
  schoolId: null,
  deletedAt: null,
};

describe('UserEntity.fromObject', () => {
  it('creates entity from valid object', () => {
    const entity = UserEntity.fromObject(base);
    expect(entity.id).toBe(1);
    expect(entity.email).toBe('test@example.com');
    expect(entity.name).toBe('Test User');
    expect(entity.isActive).toBe(true);
    expect(entity.schoolName).toBeNull();
  });

  it('maps school.cenEdu to schoolName', () => {
    const entity = UserEntity.fromObject({ ...base, school: { cenEdu: 'Colegio Nacional' } });
    expect(entity.schoolName).toBe('Colegio Nacional');
  });

  it('defaults schoolName to null when no school', () => {
    const entity = UserEntity.fromObject(base);
    expect(entity.schoolName).toBeNull();
  });

  it('throws on missing id', () => {
    expect(() => UserEntity.fromObject({ ...base, id: undefined })).toThrow(CustomError);
  });

  it('throws on id = 0 (falsy)', () => {
    expect(() => UserEntity.fromObject({ ...base, id: 0 })).toThrow(CustomError);
  });

  it('throws on missing name', () => {
    expect(() => UserEntity.fromObject({ ...base, name: '' })).toThrow(CustomError);
  });

  it('throws on missing email', () => {
    expect(() => UserEntity.fromObject({ ...base, email: undefined })).toThrow(CustomError);
  });

  it('throws on invalid email format', () => {
    expect(() => UserEntity.fromObject({ ...base, email: 'not-an-email' })).toThrow(CustomError);
  });

  it('throws on missing password', () => {
    expect(() => UserEntity.fromObject({ ...base, password: '' })).toThrow(CustomError);
  });

  it('throws on missing birthDate', () => {
    expect(() => UserEntity.fromObject({ ...base, birthDate: undefined })).toThrow(CustomError);
  });

  it('defaults isActive to true when undefined', () => {
    const entity = UserEntity.fromObject({ ...base, isActive: undefined });
    expect(entity.isActive).toBe(true);
  });

  it('stores deletedAt as null when not provided', () => {
    const entity = UserEntity.fromObject(base);
    expect(entity.deletedAt).toBeNull();
  });
});
