/**
 * Admin bootstrap shared by `prisma/seed.ts` and `pnpm db:bootstrap-admin`.
 *
 * Env vars:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME  — all required, otherwise skipped
 *   ADMIN_RESET_PASSWORD=true                — overwrite an existing user's password
 *
 * Idempotent: upserts by email. A new admin is created active with
 * birthDate 1970-01-01 and no phone/school/grade. An existing user is promoted
 * to ADMIN, activated and restored; its password is kept unless reset.
 */
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { BootstrapAdminDto } from "../src/domain/dtos/user/bootstrap-admin.dto.js";
import { BootstrapAdminUseCase } from "../src/domain/use-cases/user/bootstrap-admin.use-case.js";
import { AdminBootstrapRepositoryImpl } from "../src/infrastructure/repositories/admin-bootstrap.repository.impl.js";
import { BcryptAdapter } from "../src/infrastructure/adapters/bcrypt.adapter.impl.js";

export async function runAdminBootstrap(
  prisma: PrismaClient,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  if (!BootstrapAdminDto.isConfigured(env)) {
    console.log(
      "Admin bootstrap skipped: set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME to provision an admin.",
    );
    return;
  }

  const [error, dto] = BootstrapAdminDto.fromEnv(env);
  if (error) throw new Error(`Admin bootstrap failed: ${error}`);

  const useCase = new BootstrapAdminUseCase(
    new AdminBootstrapRepositoryImpl(prisma),
    new BcryptAdapter(),
  );
  const result = await useCase.execute(dto!);

  const action = result.created ? "created" : "promoted/updated";
  const password = result.passwordUpdated ? "password set" : "password unchanged";
  console.log(`Admin ${dto!.email} ${action} (id ${result.userId}, ${password}).`);
}
