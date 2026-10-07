import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTokenService } from './api-token.service';

class CreateApiTokenDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;
}

@Controller('api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokenController {
  constructor(private tokens: ApiTokenService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tokens.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiTokenDto) {
    return this.tokens.create(user.id, dto.label);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tokens.revoke(user.id, id);
  }
}
