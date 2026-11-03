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

  it('does not reveal the field when the email format is wrong', () => {
    const [err] = LoginUserDto.create({ ...valid, email: 'bad-email' });
    expect(err).toBe('Invalid credentials');
  });

  it('does not reveal the field when the password format is wrong', () => {
    const [err] = LoginUserDto.create({ ...valid, password: 'abc123' });
    expect(err).toBe('Invalid credentials');
  });

  it.each([
    ['email', { email: { contains: 'a' }, password: 'Password1' }],
    ['password', { email: 'user@example.com', password: 12345678 }],
  ])('rejects a non-string %s before it reaches the repository', (_field, body) => {
    const [err, dto] = LoginUserDto.create(body);
    expect(err).toBe('Invalid credentials');
    expect(dto).toBeUndefined();
  });
});
