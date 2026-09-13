import { UpdateUserDto } from '../../../../../src/domain/dtos/user/update-user.dto.js';

describe('UpdateUserDto.create schoolId', () => {
  it('keeps schoolId undefined when not supplied', () => {
    const [err, dto] = UpdateUserDto.create({ name: 'New' });
    expect(err).toBeUndefined();
    expect(dto!.schoolId).toBeUndefined();
  });

  it('parses a positive integer schoolId', () => {
    const [err, dto] = UpdateUserDto.create({ schoolId: '12' });
    expect(err).toBeUndefined();
    expect(dto!.schoolId).toBe(12);
  });

  it('passes an explicit null through so the use case can decide by role', () => {
    const [err, dto] = UpdateUserDto.create({ schoolId: null });
    expect(err).toBeUndefined();
    expect(dto!.schoolId).toBeNull();
  });

  it.each([0, -1, 2.5, 'abc', ''])('rejects invalid schoolId %p', (schoolId) => {
    const [err] = UpdateUserDto.create({ schoolId });
    expect(err).toBe('Invalid School Id');
  });
});
