import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppUpdateDocument = HydratedDocument<AppUpdate>;
export type AppUpdatePlatform = 'android';

@Schema({
  collection: 'app_updates',
  timestamps: true,
  versionKey: false,
})
export class AppUpdate {
  @Prop({ required: true, unique: true, index: true })
  platform!: AppUpdatePlatform;

  @Prop({ required: true })
  versionCode!: number;

  @Prop({ required: true })
  versionName!: string;

  @Prop({ required: true, default: false })
  forceUpdate!: boolean;

  @Prop({ required: true, default: '' })
  releaseNotes!: string;

  @Prop({ required: true })
  fileName!: string;

  @Prop({ required: true })
  fileSize!: number;

  @Prop({ required: true })
  sha256!: string;

  updatedAt?: Date;
}

export const AppUpdateSchema = SchemaFactory.createForClass(AppUpdate);
