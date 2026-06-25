import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserStatus } from './user.entity';

interface ListUsersParams {
  isAdmin?: boolean;
  search?: string;
  status?: UserStatus;
  offset: number;
  count: number;
}

type PublicUser = Omit<User, 'passwordHash'>;

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

  async findAnyByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userModel.findOne({ phoneNumber }).lean<User>().exec();
  }

  async list({
    isAdmin,
    search,
    status,
    offset,
    count,
  }: ListUsersParams): Promise<{ items: PublicUser[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    }
    if (typeof isAdmin === 'boolean') {
      filter.isAdmin = isAdmin;
    }
    if (search) {
      const regex = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ phoneNumber: regex }, { userID: regex }];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(count)
        .lean<PublicUser[]>()
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findByUserID(userID: string): Promise<PublicUser | null> {
    return this.userModel
      .findOne({ userID })
      .select('-passwordHash')
      .lean<PublicUser>()
      .exec();
  }

  async upsertBootstrapAdmin(user: {
    phoneNumber: string;
    passwordHash: string;
    userID: string;
  }): Promise<void> {
    try {
      await this.userModel.updateOne(
        { phoneNumber: user.phoneNumber },
        {
          $set: {
            passwordHash: user.passwordHash,
            status: 'active',
            isAdmin: true,
          },
          $setOnInsert: {
            userID: user.userID,
            phoneNumber: user.phoneNumber,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      throw new InternalServerErrorException('管理员初始化失败', {
        cause: error,
      });
    }
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

  async updatePasswordHash(
    userID: string,
    passwordHash: string,
  ): Promise<void> {
    try {
      const result = await this.userModel.updateOne(
        { userID, status: { $in: ['active', 'disabled'] } },
        { $set: { passwordHash } },
      );
      if (result.matchedCount !== 1) {
        throw new Error('User was not found');
      }
    } catch (error) {
      throw new InternalServerErrorException('密码更新失败', {
        cause: error,
      });
    }
  }

  async setStatus(userID: string, status: 'active' | 'disabled') {
    try {
      const user = await this.userModel
        .findOneAndUpdate(
          { userID, status: { $in: ['active', 'disabled'] } },
          { $set: { status } },
          { new: true, projection: { passwordHash: 0 } },
        )
        .lean<PublicUser>()
        .exec();
      if (!user) {
        throw new Error('User was not found');
      }
      return user;
    } catch (error) {
      throw new InternalServerErrorException('用户状态更新失败', {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
