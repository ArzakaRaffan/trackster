import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** User yang login, diisi `JwtAuthGuard` dari payload JWT (`sub`/`username`) + `role` dari DB. Server-side only: jangan pernah ambil userId dari body/query. */
export interface AuthUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'MEMBER';
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const u = ctx.switchToHttp().getRequest().user;
  return { id: u.sub, username: u.username, role: u.role };
});
