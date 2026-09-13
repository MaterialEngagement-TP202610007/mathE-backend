import { toAuthUser, toPublicUser, toPublicUserWithSchool } from '../../../../src/presentation/mappers/user.mapper.js';
import { UserEntity } from '../../../../src/domain/entities/user.entity.js';

function makeUser(schoolId: number | null = 4, schoolName: string | null = 'Colegio X'): UserEntity {
  return new UserEntity(
    1, '$2a$10$hash', 'user@example.com', 'User', new Date('2000-01-01'),
    new Date(), new Date(), null, true, 3, 2, schoolId, null, schoolName,
  );
}

describe('user mapper', () => {
  describe('toPublicUser', () => {
    it('strips the password and keeps the flat school fields', () => {
      const user = toPublicUser(makeUser());
      expect(user).not.toHaveProperty('password');
      expect(user).toMatchObject({ id: 1, email: 'user@example.com', schoolId: 4, schoolName: 'Colegio X' });
    });
  });

  describe('toPublicUserWithSchool', () => {
    it('strips the password, keeps the flat fields and adds the nested school', () => {
      const user = toPublicUserWithSchool(makeUser());
      expect(user).not.toHaveProperty('password');
      expect(user).toMatchObject({ schoolId: 4, schoolName: 'Colegio X', school: { id: 4, name: 'Colegio X' } });
    });

    it('returns school null when the user has none', () => {
      expect(toPublicUserWithSchool(makeUser(null, null)).school).toBeNull();
    });
  });

  describe('toAuthUser', () => {
    it('strips the password and nests the school', () => {
      const user = toAuthUser(makeUser());
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('schoolId');
      expect(user).not.toHaveProperty('schoolName');
      expect(user.school).toEqual({ id: 4, name: 'Colegio X' });
    });

    it('returns school null when the user has none', () => {
      expect(toAuthUser(makeUser(null, null)).school).toBeNull();
    });
  });
});
