import {
  CreateAdminData,
  PromoteToAdminData,
} from "../interfaces/user/index.js";

/**
 * Narrow persistence port for the admin bootstrap. Kept separate from
 * `UserRepository` so the bootstrap script can run with its own Prisma client.
 */
export abstract class AdminBootstrapRepository {
  abstract findByEmail(email: string): Promise<{ id: number } | null>;
  abstract createAdmin(data: CreateAdminData): Promise<{ id: number }>;
  abstract promoteToAdmin(
    id: number,
    data: PromoteToAdminData,
  ): Promise<{ id: number }>;
}
