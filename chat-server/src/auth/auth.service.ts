import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { OpenImService } from '../openim/openim.service';
import { UsersRepository } from '../users/users.repository';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthUser, LoginResponse } from './auth.types';
import { hashPassword, verifyPassword } from './password';
const MAX_USER_ID_GENERATION_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly openImService: OpenImService,
  ) {}

  async register(request: RegisterDto): Promise<AuthUser> {
    const { phoneNumber, password, nickname } = request;
    const passwordHash = await hashPassword(password);
    const userID = await this.reserveUser(phoneNumber, passwordHash);

    try {
      await this.openImService.registerUser(userID, nickname ?? phoneNumber);
      await this.usersRepository.activate(userID);
    } catch (error) {
      await this.usersRepository.deletePending(userID);
      throw error;
    }

    return { userID, phoneNumber };
  }

  private async reserveUser(
    phoneNumber: string,
    passwordHash: string,
  ): Promise<string> {
    for (
      let attempt = 1;
      attempt <= MAX_USER_ID_GENERATION_ATTEMPTS;
      attempt++
    ) {
      const userID = this.generateUserID();
      try {
        await this.usersRepository.reserve({
          userID,
          phoneNumber,
          passwordHash,
        });
        return userID;
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }
        if (attempt === MAX_USER_ID_GENERATION_ATTEMPTS) {
          throw new InternalServerErrorException('用户 ID 生成失败', {
            cause: error,
          });
        }
      }
    }

    throw new InternalServerErrorException('用户 ID 生成失败');
  }

  async login(request: LoginDto): Promise<LoginResponse> {
    const { phoneNumber, password, platformID } = request;
    const user = await this.usersRepository.findByPhoneNumber(phoneNumber);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const tokenResult = await this.openImService.getUserToken(
      user.userID,
      platformID,
    );
    return {
      userID: user.userID,
      phoneNumber: user.phoneNumber,
      ...tokenResult,
    };
  }

  async findUserIDByPhoneNumber(phoneNumber: string): Promise<AuthUser> {
    const user = await this.usersRepository.findByPhoneNumber(phoneNumber);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return {
      userID: user.userID,
      phoneNumber: user.phoneNumber,
    };
  }

  async changePassword(request: ChangePasswordDto): Promise<AuthUser> {
    const { phoneNumber, oldPassword, newPassword } = request;
    const user = await this.usersRepository.findByPhoneNumber(phoneNumber);

    if (!user || !(await verifyPassword(oldPassword, user.passwordHash))) {
      throw new UnauthorizedException('旧密码错误');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.usersRepository.updatePasswordHash(user.userID, passwordHash);
    return {
      userID: user.userID,
      phoneNumber: user.phoneNumber,
    };
  }

  private generateUserID(): string {
    return randomInt(1_000_000_000, 10_000_000_000).toString();
  }
}
