import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminSessionService } from './admin-session.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { OpenImModule } from '../openim/openim.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, OpenImModule],
  controllers: [AdminAuthController, AdminController],
  providers: [
    AdminAuthGuard,
    AdminAuthService,
    AdminBootstrapService,
    AdminService,
    AdminSessionService,
  ],
  exports: [AdminAuthGuard, AdminSessionService],
})
export class AdminModule {}
