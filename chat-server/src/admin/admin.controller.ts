import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import {
  ListAdminUsersDto,
  ResetUserPasswordDto,
  SearchMessagesDto,
  SetUserStatusDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: ListAdminUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users/:userID/reset-password')
  @HttpCode(HttpStatus.OK)
  resetUserPassword(
    @Param('userID') userID: string,
    @Body() body: ResetUserPasswordDto,
  ) {
    return this.adminService.resetUserPassword(userID, body.newPassword);
  }

  @Post('users/:userID/status')
  @HttpCode(HttpStatus.OK)
  setUserStatus(
    @Param('userID') userID: string,
    @Body() body: SetUserStatusDto,
  ) {
    return this.adminService.setUserLoginStatus(userID, body);
  }

  @Get('messages')
  searchMessages(@Query() query: SearchMessagesDto) {
    return this.adminService.searchMessages(query);
  }
}
