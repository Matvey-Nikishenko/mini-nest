import 'reflect-metadata';
import { Injectable } from '../decorators/injectable.js';
import type { ExecutionContext } from '../http/execution-context.js';
import type { CanActivate } from '../http/interfaces.js';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const authorizationHeader = ctx.req.headers.authorization;
    return typeof authorizationHeader === 'string' && authorizationHeader.trim().length > 0;
  }
}
