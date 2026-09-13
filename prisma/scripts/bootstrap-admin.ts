/**
 * Standalone admin bootstrap — provisions the admin account without re-running
 * the full seed (roles, grades, ~5.9k schools).
 *
 * Run with:  pnpm db:bootstrap-admin
 * Requires:  DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 * Optional:  ADMIN_RESET_PASSWORD=true
 *
 * Roles must already exist (migrations seed them). Unlike the seed, missing
 * ADMIN_* vars are an error here, since running this script means you want an admin.
 */
import "dotenv/config";
import envVar from "env-var";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { BootstrapAdminDto } from "../../src/domain/dtos/user/bootstrap-admin.dto.js";
import { runAdminBootstrap } from "../admin-bootstrap.js";

const connectionString = envVar.get("DATABASE_URL").required().asString();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const [error] = BootstrapAdminDto.fromEnv(process.env);
  if (error) throw new Error(`Admin bootstrap failed: ${error}`);
  await runAdminBootstrap(prisma);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
