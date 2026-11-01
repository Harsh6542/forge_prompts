import { SetMetadata } from '@nestjs/common';

/**
 * Role requirement metadata key consumed by RoleGuard.
 * Usage: @Roles('pwd_admin', 'municipal_admin')
 * Superadmin is always implicitly allowed (baked into RoleGuard).
 */
export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
