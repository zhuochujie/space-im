import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyPassword } from '../auth/password';
import { UsersRepository } from '../users/users.repository';
import { AdminSessionService } from './admin-session.service';
import { AdminLoginDto } from './dto/admin.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly adminSessionService: AdminSessionService,
  ) {}

  async login(body: AdminLoginDto) {
    const user = await this.usersRepository.findByPhoneNumber(body.phoneNumber);
    if (
      !user ||
      !user.isAdmin ||
      !(await verifyPassword(body.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const token = this.adminSessionService.sign({
      sub: user.userID,
      phoneNumber: user.phoneNumber,
    });
    return {
      token,
      user: {
        userID: user.userID,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
      },
    };
  }
}
