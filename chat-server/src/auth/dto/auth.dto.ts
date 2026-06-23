import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export class AuthCredentialsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '用户名必须是字符串' })
  @Length(6, 32, { message: '用户名长度必须为 3-32 位' })
  @Matches(USERNAME_PATTERN, {
    message: '用户名只能包含字母、数字、下划线、点和短横线',
  })
  username!: string;

  @IsString({ message: '密码必须是字符串' })
  @Length(10, 128, { message: '密码长度必须为 8-128 位' })
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
  @IsString({ message: '用户名必须是字符串' })
  @Length(6, 32, { message: '用户名长度必须为 3-32 位' })
  @Matches(USERNAME_PATTERN, {
    message: '用户名只能包含字母、数字、下划线、点和短横线',
  })
  username!: string;

  @IsString({ message: '旧密码必须是字符串' })
  @Length(10, 128, { message: '旧密码长度必须为 8-128 位' })
  oldPassword!: string;

  @IsString({ message: '新密码必须是字符串' })
  @Length(10, 128, { message: '新密码长度必须为 8-128 位' })
  newPassword!: string;
}

export class SearchUserByUsernameDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '用户名必须是字符串' })
  @Length(3, 32, { message: '用户名长度必须为 3-32 位' })
  @Matches(USERNAME_PATTERN, {
    message: '用户名只能包含字母、数字、下划线、点和短横线',
  })
  username!: string;
}
