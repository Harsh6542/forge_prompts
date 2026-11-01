import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class DeptGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targetDept = this.reflector.getAllAndOverride<string>('targetDept', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no department target, allow access
    if (!targetDept) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user, deny access
    if (!user) {
      throw new ForbiddenException('Access denied: no user found');
    }

    // Superadmin can access all departments
    if (user.role === 'superadmin') {
      return true;
    }

    // Check if user's department matches the target department
    if (user.department === targetDept) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied: role '${user.role}' (department: ${user.department}) cannot access ${targetDept} department resources`,
    );
  }
}