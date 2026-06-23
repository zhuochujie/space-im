import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import { OpenImService } from '../openim/openim.service';
import { UsersRepository } from '../users/users.repository';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthUser, LoginResponse } from './auth.types';

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};
const MAX_USER_ID_GENERATION_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly openImService: OpenImService,
  ) {}

  async register(request: RegisterDto): Promise<AuthUser> {
    const { username, password, nickname } = request;
    const passwordHash = await this.hashPassword(password);
    const userID = await this.reserveUser(username, passwordHash);

    try {
      await this.openImService.registerUser(userID, nickname ?? '');
      await this.usersRepository.activate(userID);
    } catch (error) {
      await this.usersRepository.deletePending(userID);
      throw error;
    }

    return { userID, username };
  }

  private async reserveUser(
    username: string,
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
          username,
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
    const { username, password, platformID } = request;
    const user = await this.usersRepository.findByUsername(username);

    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const tokenResult = await this.openImService.getUserToken(
      user.userID,
      platformID,
    );
    return {
      userID: user.userID,
      username: user.username,
      ...tokenResult,
    };
  }

  async findUserIDByUsername(username: string): Promise<AuthUser> {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return {
      userID: user.userID,
      username: user.username,
    };
  }

  async changePassword(request: ChangePasswordDto): Promise<AuthUser> {
    const { username, oldPassword, newPassword } = request;
    const user = await this.usersRepository.findByUsername(username);

    if (
      !user ||
      !(await this.verifyPassword(oldPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('旧密码错误');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.usersRepository.updatePasswordHash(user.userID, passwordHash);
    return {
      userID: user.userID,
      username: user.username,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  private generateUserID(): string {
    return randomInt(1_000_000_000, 10_000_000_000).toString();
  }

  private async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(storedHash, password);
    } catch {
      return false;
    }
  }
}
