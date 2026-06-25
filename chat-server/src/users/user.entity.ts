import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserStatus = 'pending' | 'active' | 'disabled';

@Schema({
  collection: 'chat_server_users',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({ required: true, unique: true, index: true })
  userID!: string;

  @Prop({ required: true, unique: true, index: true })
  phoneNumber!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, default: false })
  isAdmin!: boolean;

  @Prop({
    required: true,
    enum: ['pending', 'active', 'disabled'],
    default: 'pending',
  })
  status!: UserStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
