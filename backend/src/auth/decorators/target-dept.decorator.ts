import { SetMetadata } from '@nestjs/common';

/**
 * Department-level restriction metadata key consumed by DeptGuard.
 * Usage: @TargetDept('PWD')
 * Superadmin is always implicitly allowed (baked into DeptGuard).
 */
export const TARGET_DEPT_KEY = 'targetDept';

export const TargetDept = (department: string) =>
  SetMetadata(TARGET_DEPT_KEY, department);
