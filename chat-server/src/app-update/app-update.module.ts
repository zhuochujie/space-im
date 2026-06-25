import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminModule } from '../admin/admin.module';
import { UsersModule } from '../users/users.module';
import { AppUpdateController } from './app-update.controller';
import { AppUpdate, AppUpdateSchema } from './app-update.entity';
import { AppUpdateRepository } from './app-update.repository';
import { AppUpdateService } from './app-update.service';

@Module({
  imports: [
    AdminModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: AppUpdate.name, schema: AppUpdateSchema },
    ]),
  ],
  controllers: [AppUpdateController],
  providers: [AppUpdateRepository, AppUpdateService],
})
export class AppUpdateModule {}
