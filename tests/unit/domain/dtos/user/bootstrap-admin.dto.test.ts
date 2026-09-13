import { BootstrapAdminDto } from '../../../../../src/domain/dtos/user/bootstrap-admin.dto.js';

const env = {
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'Password1',
  ADMIN_NAME: 'Platform Admin',
};

describe('BootstrapAdminDto', () => {
  describe('isConfigured', () => {
    it('is true when email, password and name are all set', () => {
      expect(BootstrapAdminDto.isConfigured(env)).toBe(true);
    });

    it.each(['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_NAME'])(
      'is false when %s is missing or blank',
      (key) => {
        expect(BootstrapAdminDto.isConfigured({ ...env, [key]: undefined })).toBe(false);
        expect(BootstrapAdminDto.isConfigured({ ...env, [key]: '   ' })).toBe(false);
      },
    );
  });

  describe('fromEnv', () => {
    it('creates a dto with trimmed values and resetPassword=false by default', () => {
      const [err, dto] = BootstrapAdminDto.fromEnv({
        ...env,
        ADMIN_EMAIL: '  admin@example.com ',
        ADMIN_NAME: ' Platform Admin ',
      });
      expect(err).toBeUndefined();
      expect(dto!.email).toBe('admin@example.com');
      expect(dto!.name).toBe('Platform Admin');
      expect(dto!.password).toBe('Password1');
      expect(dto!.resetPassword).toBe(false);
    });

    it('enables resetPassword only when ADMIN_RESET_PASSWORD is "true"', () => {
      expect(BootstrapAdminDto.fromEnv({ ...env, ADMIN_RESET_PASSWORD: 'true' })[1]!.resetPassword).toBe(true);
      expect(BootstrapAdminDto.fromEnv({ ...env, ADMIN_RESET_PASSWORD: 'TRUE' })[1]!.resetPassword).toBe(true);
      expect(BootstrapAdminDto.fromEnv({ ...env, ADMIN_RESET_PASSWORD: '1' })[1]!.resetPassword).toBe(false);
      expect(BootstrapAdminDto.fromEnv({ ...env, ADMIN_RESET_PASSWORD: 'false' })[1]!.resetPassword).toBe(false);
    });

    it('rejects missing variables with the variable name', () => {
      const [err, dto] = BootstrapAdminDto.fromEnv({ ...env, ADMIN_NAME: undefined });
      expect(err).toContain('ADMIN_NAME');
      expect(dto).toBeUndefined();
    });

    it('rejects an invalid email', () => {
      const [err] = BootstrapAdminDto.fromEnv({ ...env, ADMIN_EMAIL: 'not-an-email' });
      expect(err).toContain('ADMIN_EMAIL');
    });

    it.each(['short1', 'onlyletters', '12345678', 'Password1!'])(
      'rejects a password that does not match the project policy (%s)',
      (password) => {
        const [err, dto] = BootstrapAdminDto.fromEnv({ ...env, ADMIN_PASSWORD: password });
        expect(err).toContain('ADMIN_PASSWORD');
        expect(err).toContain('at least 8 characters');
        expect(dto).toBeUndefined();
      },
    );
  });
});
