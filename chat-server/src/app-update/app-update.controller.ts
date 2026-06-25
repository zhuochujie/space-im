import {
  Controller,
  Get,
  Header,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AppUpdateService } from './app-update.service';
import { UploadAndroidAppDto } from './dto/app-update.dto';
import type { Request, Response } from 'express';

@Controller()
export class AppUpdateController {
  constructor(private readonly appUpdateService: AppUpdateService) {}

  @Get('app-update/android/latest')
  getLatest(@Req() request: Request) {
    return this.appUpdateService.getLatest(this.baseUrl(request));
  }

  @Get('app-update/android/download')
  @Header('Content-Type', 'application/vnd.android.package-archive')
  async download(@Res() response: Response) {
    const file = await this.appUpdateService.getDownload();
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    file.stream.pipe(response);
  }

  @Put('admin/app-update/android')
  @UseGuards(AdminAuthGuard)
  upload(@Query() query: UploadAndroidAppDto, @Req() request: Request) {
    return this.appUpdateService.uploadAndroidApk(
      query,
      request,
      this.baseUrl(request),
    );
  }

  private baseUrl(request: Request) {
    const configured = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
    if (configured) {
      return configured;
    }
    return `${request.protocol}://${request.get('host')}`;
  }
}
