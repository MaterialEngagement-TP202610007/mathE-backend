import { LoginUserDto } from '../../../../../src/domain/dtos/auth/login-user.dto.js';

describe('LoginUserDto.create', () => {
  const valid = { email: 'user@example.com', password: 'Password1' };

  it('creates valid dto', () => {
    const [err, dto] = LoginUserDto.create(valid);
    expect(err).toBeUndefined();
    expect(dto!.email).toBe('user@example.com');
    expect(dto!.password).toBe('Password1');
  });

  it('rejects missing email', () => {
    const [err] = LoginUserDto.create({ ...valid, email: undefined });
    expect(err).toBe('Missing Email');
  });

  it('rejects missing password', () => {
    const [err] = LoginUserDto.create({ ...valid, password: undefined });
    expect(err).toBe('Missing Password');
  });

  it('rejects invalid email format', () => {
    const [err] = LoginUserDto.create({ ...valid, email: 'bad-email' });
    expect(err).toBe('Invalid Email');
  });

  it('rejects invalid password format', () => {
    const [err] = LoginUserDto.create({ ...valid, password: 'short' });
    expect(err).toBe('Invalid Password');
  });
});
