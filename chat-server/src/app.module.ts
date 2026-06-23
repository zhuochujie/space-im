import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { loadEnvFile } from 'node:process';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';

try {
  loadEnvFile();
} catch (error: unknown) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

const mongoUsername = process.env.MONGO_USERNAME;
const mongoPassword = process.env.MONGO_PASSWORD;

if (Boolean(mongoUsername) !== Boolean(mongoPassword)) {
  throw new Error('MONGO_USERNAME 和 MONGO_PASSWORD 必须同时配置');
}

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:37017',
      {
        dbName: process.env.MONGODB_DATABASE ?? 'chat_server',
        ...(mongoUsername && mongoPassword
          ? {
              user: mongoUsername,
              pass: mongoPassword,
              authSource: process.env.MONGO_AUTH_SOURCE ?? 'chat_server',
            }
          : {}),
        lazyConnection: true,
        serverSelectionTimeoutMS: 5_000,
      },
    ),
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
