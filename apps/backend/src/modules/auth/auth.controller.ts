import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

const COOKIE_NAME = 'trackster_jwt';
const isProd = process.env.NODE_ENV === 'production';
// Di production, frontend & backend beda subdomain (track.x vs api.track.x), jadi cookie perlu
// di-scope ke domain induk bersama biar keduanya bisa baca cookie yang sama.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

const setAuthCookie = (res: Response, token: string) =>
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    domain: COOKIE_DOMAIN,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
  });

// Login, register, reset: 10 percobaan/menit/IP (AuthRateLimitGuard, terpisah dari throttler split-bill).
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.validateAndLogin(dto.username, dto.password);
    setAuthCookie(res, token);
    return { user };
  }

  @UseGuards(AuthRateLimitGuard)
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.register(dto);
    setAuthCookie(res, token);
    return { user };
  }

  @UseGuards(AuthRateLimitGuard)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) res: Response) {
    const { token } = await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    setAuthCookie(res, token);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(user.id);
    res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
    return { success: true };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const payload = (req as any).user;
    const user = await this.authService.getUserById(payload.sub);
    return { user };
  }
}
