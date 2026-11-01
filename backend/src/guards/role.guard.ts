import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no role requirement, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user or no role, deny access
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no user role found');
    }

    // Superadmin can access everything
    if (user.role === 'superadmin') {
      return true;
    }

    // Check if user's role is in the required roles list
    const hasAccess = requiredRoles.includes(user.role);

    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied: role '${user.role}' does not have permission. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}