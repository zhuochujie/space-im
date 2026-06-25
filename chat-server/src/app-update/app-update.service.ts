import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { UploadAndroidAppDto } from './dto/app-update.dto';
import { AppUpdate, AppUpdatePlatform } from './app-update.entity';
import { AppUpdateRepository } from './app-update.repository';

const PLATFORM: AppUpdatePlatform = 'android';
const APK_FILE_NAME = 'latest.apk';

@Injectable()
export class AppUpdateService {
  constructor(private readonly repository: AppUpdateRepository) {}

  async getLatest(baseUrl: string) {
    const update = await this.repository.findLatest(PLATFORM);
    if (!update) {
      return null;
    }
    return this.toResponse(update, baseUrl);
  }

  async getDownload() {
    const update = await this.repository.findLatest(PLATFORM);
    if (!update) {
      throw new NotFoundException('暂无安卓安装包');
    }
    const filePath = this.apkPath;
    await stat(filePath).catch(() => {
      throw new NotFoundException('安装包文件不存在');
    });
    return {
      fileName: update.fileName,
      filePath,
      stream: createReadStream(filePath),
    };
  }

  async uploadAndroidApk(
    dto: UploadAndroidAppDto,
    stream: Readable,
    baseUrl: string,
  ) {
    await mkdir(dirname(this.apkPath), { recursive: true });
    const tempPath = `${this.apkPath}.${Date.now()}.tmp`;
    const hash = createHash('sha256');
    let size = 0;

    const digestStream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    await pipeline(stream, digestStream, createWriteStream(tempPath)).catch(
      async (error) => {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
      },
    );

    if (size === 0) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw new BadRequestException('安装包不能为空');
    }

    await rename(tempPath, this.apkPath).catch(async (error) => {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    });

    const update = await this.repository.saveLatest({
      platform: PLATFORM,
      versionCode: dto.versionCode,
      versionName: dto.versionName,
      forceUpdate: dto.forceUpdate,
      releaseNotes: dto.releaseNotes ?? '',
      fileName: APK_FILE_NAME,
      fileSize: size,
      sha256: hash.digest('hex'),
    });
    return this.toResponse(update, baseUrl);
  }

  private toResponse(update: AppUpdate, baseUrl: string) {
    return {
      platform: update.platform,
      versionCode: update.versionCode,
      versionName: update.versionName,
      forceUpdate: update.forceUpdate,
      releaseNotes: update.releaseNotes,
      fileSize: update.fileSize,
      sha256: update.sha256,
      apkUrl: `${baseUrl}/app-update/android/download`,
      updatedAt: update.updatedAt,
    };
  }

  private get apkPath() {
    const storageRoot =
      process.env.APP_UPDATE_STORAGE_DIR ?? join(process.cwd(), 'storage');
    return join(storageRoot, 'app-updates', PLATFORM, APK_FILE_NAME);
  }
}
