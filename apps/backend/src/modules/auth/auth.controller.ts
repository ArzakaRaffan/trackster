import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const COOKIE_NAME = 'trackster_jwt';
const isProd = process.env.NODE_ENV === 'production';
// Di production, frontend & backend beda subdomain (track.x vs api.track.x), jadi cookie perlu
// di-scope ke domain induk bersama biar keduanya bisa baca cookie yang sama.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.validateAndLogin(dto.username, dto.password);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain: COOKIE_DOMAIN,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    });

    return { user };
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
