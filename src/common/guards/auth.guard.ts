import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { auth } from '../../lib/auth';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const nodeHeaders = request.headers;

    const fetchHeaders = new Headers();
    for (const [key, value] of Object.entries(nodeHeaders)) {
      if (Array.isArray(value)) {
        for (const v of value) fetchHeaders.append(key, v);
      } else if (typeof value === 'string') {
        fetchHeaders.set(key, value);
      } else if (typeof value === 'number') {
        fetchHeaders.set(key, String(value));
      }
    }

    try {
      const result = await auth.api.getSession({
        headers: fetchHeaders,
      });

      if (!result || !result.session || !result.user) {
        throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED });
      }

      request['userId'] = result.session.userId;
      request['user'] = result.user as any;
      return true;
    } catch (error) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED });
    }
  }
}
