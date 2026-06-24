import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userModel
      .findOne({ phoneNumber, status: 'active' })
      .lean<User>()
      .exec();
  }

  async reserve(user: Pick<User, 'userID' | 'phoneNumber' | 'passwordHash'>) {
    try {
      await this.userModel.create({ ...user, status: 'pending' });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        if (this.isDuplicatePhoneNumberError(error)) {
          throw new ConflictException('手机号已注册');
        }
        throw error;
      }
      throw new InternalServerErrorException('用户数据保存失败', {
        cause: error,
      });
    }
  }

  async activate(userID: string): Promise<void> {
    try {
      const result = await this.userModel.updateOne(
        { userID, status: 'pending' },
        { $set: { status: 'active' } },
      );
      if (result.modifiedCount !== 1) {
        throw new Error('Pending user was not found');
      }
    } catch (error) {
      throw new InternalServerErrorException('用户状态更新失败', {
        cause: error,
      });
    }
  }

  async deletePending(userID: string): Promise<void> {
    try {
      await this.userModel.deleteOne({ userID, status: 'pending' });
    } catch (error) {
      throw new InternalServerErrorException('注册失败记录清理失败', {
        cause: error,
      });
    }
  }

  async updatePasswordHash(userID: string, passwordHash: string): Promise<void> {
    try {
      const result = await this.userModel.updateOne(
        { userID, status: 'active' },
        { $set: { passwordHash } },
      );
      if (result.matchedCount !== 1) {
        throw new Error('Active user was not found');
      }
    } catch (error) {
      throw new InternalServerErrorException('密码更新失败', {
        cause: error,
      });
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private isDuplicatePhoneNumberError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'keyPattern' in error &&
      typeof error.keyPattern === 'object' &&
      error.keyPattern !== null &&
      'phoneNumber' in error.keyPattern
    );
  }
}
