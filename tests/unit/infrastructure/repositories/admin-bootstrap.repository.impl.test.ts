import { AdminBootstrapRepositoryImpl } from '../../../../src/infrastructure/repositories/admin-bootstrap.repository.impl.js';
import type { PrismaClient } from '../../../../src/generated/prisma/client.js';

function makePrisma() {
  const user = {
    findUnique: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 5 }),
  };
  return { client: { user } as unknown as PrismaClient, user };
}

describe('AdminBootstrapRepositoryImpl', () => {
  it('looks up users by email returning only the id', async () => {
    const { client, user } = makePrisma();
    user.findUnique.mockResolvedValueOnce({ id: 9 });

    const found = await new AdminBootstrapRepositoryImpl(client).findByEmail('a@b.co');

    expect(user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.co' }, select: { id: true } });
    expect(found).toEqual({ id: 9 });
  });

  it('creates an active admin with nullable profile columns left empty', async () => {
    const { client, user } = makePrisma();
    const birthDate = new Date('1970-01-01T00:00:00.000Z');

    await new AdminBootstrapRepositoryImpl(client).createAdmin({
      email: 'a@b.co', name: 'Admin', passwordHash: 'hash', roleId: 1, birthDate,
    });

    expect(user.create).toHaveBeenCalledWith({
      data: {
        email: 'a@b.co',
        name: 'Admin',
        password: 'hash',
        roleId: 1,
        birthDate,
        isActive: true,
        phoneNumber: null,
        academicGradeId: null,
        schoolId: null,
      },
      select: { id: true },
    });
  });

  it('promotes without writing the password when no hash is given', async () => {
    const { client, user } = makePrisma();

    await new AdminBootstrapRepositoryImpl(client).promoteToAdmin(5, { name: 'Admin', roleId: 1 });

    expect(user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { name: 'Admin', roleId: 1, isActive: true, deletedAt: null },
      select: { id: true },
    });
  });

  it('promotes and replaces the password when a hash is given', async () => {
    const { client, user } = makePrisma();

    await new AdminBootstrapRepositoryImpl(client).promoteToAdmin(5, {
      name: 'Admin', roleId: 1, passwordHash: 'new-hash',
    });

    expect(user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { name: 'Admin', roleId: 1, isActive: true, deletedAt: null, password: 'new-hash' },
      select: { id: true },
    });
  });
});
