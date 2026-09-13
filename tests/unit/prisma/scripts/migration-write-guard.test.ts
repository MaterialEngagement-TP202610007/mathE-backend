import { resolveMigrationWrite } from '../../../../prisma/scripts/migration-write-guard.js';

const DEFAULT_OUT = 'prisma/migrations/20260913120000_merge_schools_by_institution/migration.sql';

describe('resolveMigrationWrite', () => {
  it('writes to the default path when it does not exist yet', () => {
    const result = resolveMigrationWrite([], DEFAULT_OUT, () => false);

    expect(result).toEqual({ ok: true, outPath: DEFAULT_OUT });
  });

  it('uses the first positional argument as the output path', () => {
    const result = resolveMigrationWrite(['out/custom.sql'], DEFAULT_OUT, () => false);

    expect(result).toEqual({ ok: true, outPath: 'out/custom.sql' });
  });

  it('refuses to overwrite an existing migration file without --force', () => {
    const result = resolveMigrationWrite([], DEFAULT_OUT, () => true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(DEFAULT_OUT);
      expect(result.message).toContain('--force');
    }
  });

  it('overwrites an existing file when --force is passed in any position', () => {
    expect(resolveMigrationWrite(['--force'], DEFAULT_OUT, () => true)).toEqual({
      ok: true,
      outPath: DEFAULT_OUT,
    });
    expect(resolveMigrationWrite(['out/custom.sql', '--force'], DEFAULT_OUT, () => true)).toEqual({
      ok: true,
      outPath: 'out/custom.sql',
    });
  });
});
