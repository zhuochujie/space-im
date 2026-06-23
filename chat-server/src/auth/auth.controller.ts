import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  SearchUserByUsernameDto,
} from './dto/auth.dto';
import type { AuthUser, LoginResponse } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto): Promise<AuthUser> {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() body: ChangePasswordDto): Promise<AuthUser> {
    return this.authService.changePassword(body);
  }

  @Get('users/by-username')
  async findUserIDByUsername(
    @Query() query: SearchUserByUsernameDto,
  ): Promise<AuthUser> {
    return this.authService.findUserIDByUsername(query.username);
  }
}
