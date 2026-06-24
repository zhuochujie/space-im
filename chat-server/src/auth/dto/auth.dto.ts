import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const PHONE_MESSAGE = '手机号格式不正确';
const PASSWORD_LENGTH_MESSAGE = '密码长度必须为 6-128 位';

export class AuthCredentialsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '手机号必须是字符串' })
  @Matches(PHONE_PATTERN, {
    message: PHONE_MESSAGE,
  })
  phoneNumber!: string;

  @IsString({ message: '密码必须是字符串' })
  @Length(6, 128, { message: PASSWORD_LENGTH_MESSAGE })
  password!: string;
}

export class RegisterDto extends AuthCredentialsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  @Length(1, 32, { message: '昵称长度必须为 1-32 位' })
  nickname?: string;
}

export class LoginDto extends AuthCredentialsDto {
  @IsInt({ message: 'platformID 必须是整数' })
  @Min(1, { message: 'platformID 必须大于 0' })
  platformID!: number;
}

export class ChangePasswordDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '手机号必须是字符串' })
  @Matches(PHONE_PATTERN, {
    message: PHONE_MESSAGE,
  })
  phoneNumber!: string;

  @IsString({ message: '旧密码必须是字符串' })
  @Length(6, 128, { message: '旧密码长度必须为 6-128 位' })
  oldPassword!: string;

  @IsString({ message: '新密码必须是字符串' })
  @Length(6, 128, { message: '新密码长度必须为 6-128 位' })
  newPassword!: string;
}

export class SearchUserByPhoneNumberDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '手机号必须是字符串' })
  @Matches(PHONE_PATTERN, {
    message: PHONE_MESSAGE,
  })
  phoneNumber!: string;
}
