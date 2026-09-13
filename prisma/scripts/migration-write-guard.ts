/**
 * Guard for SQL generators that write migration files.
 *
 * Applied migrations are checksummed by Prisma: silently rewriting one breaks
 * `prisma migrate deploy`. An existing output file is therefore only
 * overwritten when `--force` is passed explicitly.
 */

export type MigrationWriteDecision =
  | { ok: true; outPath: string }
  | { ok: false; message: string };

export function resolveMigrationWrite(
  args: string[],
  defaultOutPath: string,
  fileExists: (path: string) => boolean,
): MigrationWriteDecision {
  const force = args.includes("--force");
  const outPath = args.find((arg) => !arg.startsWith("--")) ?? defaultOutPath;

  if (fileExists(outPath) && !force) {
    return {
      ok: false,
      message:
        `Refusing to overwrite ${outPath}: the file already exists and may be an ` +
        `applied migration (changing it breaks the Prisma checksum). ` +
        `Write to another path, or pass --force to overwrite it.`,
    };
  }

  return { ok: true, outPath };
}
