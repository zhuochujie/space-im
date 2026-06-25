import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UploadAndroidAppDto {
  @Type(() => Number)
  @IsInt({ message: 'versionCode 必须是整数' })
  @Min(1, { message: 'versionCode 必须大于 0' })
  versionCode!: number;

  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString({ message: 'versionName 必须是字符串' })
  @Length(1, 32, { message: 'versionName 长度必须为 1-32 位' })
  versionName!: string;

  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean({ message: 'forceUpdate 必须是布尔值' })
  forceUpdate!: boolean;

  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString({ message: 'releaseNotes 必须是字符串' })
  @MaxLength(2000, { message: 'releaseNotes 不能超过 2000 字' })
  releaseNotes?: string;
}
