import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { UserStatus } from '../../users/user.entity';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const USER_STATUSES = ['pending', 'active', 'disabled'];
const LOGIN_STATUSES = ['active', 'disabled'] as const;

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ListAdminUsersDto {
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString({ message: '搜索内容必须是字符串' })
  search?: string;

  @IsOptional()
  @IsIn(USER_STATUSES, { message: '用户状态不正确' })
  status?: UserStatus;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'offset 必须是整数' })
  @Min(0, { message: 'offset 不能小于 0' })
  offset = 0;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'count 必须是整数' })
  @Min(1, { message: 'count 必须大于 0' })
  @Max(100, { message: 'count 不能超过 100' })
  count = 50;
}

export class AdminLoginDto {
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString({ message: '手机号必须是字符串' })
  @Matches(PHONE_PATTERN, { message: '手机号格式不正确' })
  phoneNumber!: string;

  @IsString({ message: '密码必须是字符串' })
  @Length(6, 128, { message: '密码长度必须为 6-128 位' })
  password!: string;
}

export class ResetUserPasswordDto {
  @IsString({ message: '新密码必须是字符串' })
  @Length(6, 128, { message: '新密码长度必须为 6-128 位' })
  newPassword!: string;
}

export class SetUserStatusDto {
  @IsIn(LOGIN_STATUSES, { message: '登录状态只能是 active 或 disabled' })
  status!: (typeof LOGIN_STATUSES)[number];
}

export class SearchMessagesDto {
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString({ message: 'sendID 必须是字符串' })
  sendID?: string;

  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString({ message: 'recvID 必须是字符串' })
  recvID?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'contentType 必须是整数' })
  @Min(0, { message: 'contentType 不能小于 0' })
  contentType?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'sessionType 必须是整数' })
  @IsIn([1, 3], { message: 'sessionType 只能是 1 或 3' })
  sessionType = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 必须大于 0' })
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'count 必须是整数' })
  @Min(1, { message: 'count 必须大于 0' })
  @Max(100, { message: 'count 不能超过 100' })
  count = 50;
}
