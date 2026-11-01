import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthedRequestUser } from '../auth/types.js';

interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  role: AuthedRequestUser['role'];
  department: string | null;
  exp?: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException('Token expired');
      }
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      department: payload.department,
    } satisfies AuthedRequestUser;
    return true;
  }
}
