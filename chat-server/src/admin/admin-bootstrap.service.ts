import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { hashPassword } from '../auth/password';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async onModuleInit(): Promise<void> {
    const phoneNumber = process.env.SPACE_ADMIN_PHONE_NUMBER;
    const password = process.env.SPACE_ADMIN_PASSWORD;
    if (!phoneNumber && !password) {
      return;
    }
    if (!phoneNumber || !password) {
      this.logger.warn(
        'SPACE_ADMIN_PHONE_NUMBER 和 SPACE_ADMIN_PASSWORD 必须同时配置',
      );
      return;
    }

    const passwordHash = await hashPassword(password);
    await this.usersRepository.upsertBootstrapAdmin({
      phoneNumber,
      passwordHash,
      userID: randomInt(1_000_000_000, 10_000_000_000).toString(),
    });
    this.logger.log(`后台管理员账号已初始化: ${phoneNumber}`);
  }
}
