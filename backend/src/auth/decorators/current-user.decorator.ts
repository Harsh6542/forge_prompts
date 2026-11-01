import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequestUser } from '../types.js';

/**
 * Injects the verified JWT payload (request.user) into a handler argument.
 * Usage: getMe(@CurrentUser() user: AuthedRequestUser)
 * Usage: listAdmins(@CurrentUser('id') userId: number)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthedRequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthedRequestUser | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
