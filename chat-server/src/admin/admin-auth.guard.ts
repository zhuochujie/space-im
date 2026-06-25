import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminSessionService } from './admin-session.service';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly adminSessionService: AdminSessionService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = getBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('请先登录后台');
    }

    const payload = this.adminSessionService.verify(token);
    const user = await this.usersRepository.findByUserID(payload.sub);
    if (!user || user.status !== 'active' || !user.isAdmin) {
      throw new UnauthorizedException('后台登录已失效');
    }
    return true;
  }
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  const [type, token] = authorization?.split(' ') ?? [];
  if (type?.toLowerCase() === 'bearer') {
    return token;
  }
  return undefined;
}
