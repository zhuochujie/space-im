import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AppUpdate,
  AppUpdateDocument,
  AppUpdatePlatform,
} from './app-update.entity';

@Injectable()
export class AppUpdateRepository {
  constructor(
    @InjectModel(AppUpdate.name)
    private readonly appUpdateModel: Model<AppUpdateDocument>,
  ) {}

  findLatest(platform: AppUpdatePlatform) {
    return this.appUpdateModel.findOne({ platform }).lean<AppUpdate>().exec();
  }

  async saveLatest(update: AppUpdate): Promise<AppUpdate> {
    return this.appUpdateModel
      .findOneAndUpdate(
        { platform: update.platform },
        { $set: update },
        { new: true, upsert: true },
      )
      .lean<AppUpdate>()
      .exec();
  }
}
