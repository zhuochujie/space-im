import { Module } from '@nestjs/common';
import { OpenImModule } from '../openim/openim.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule, OpenImModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
