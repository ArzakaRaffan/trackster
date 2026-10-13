import { Body, Controller, Get, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { BanksDto, ReplaceAccountsDto, UpdateProfileDto } from './dto/profile.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profile.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profile.update(user.id, dto);
  }

  @Put('accounts')
  accounts(@CurrentUser() user: AuthUser, @Body() dto: ReplaceAccountsDto) {
    return this.profile.replaceAccounts(user.id, dto.accounts);
  }

  @Post('banks')
  banks(@CurrentUser() user: AuthUser, @Body() dto: BanksDto) {
    return this.profile.addBanks(user.id, dto.sources);
  }

  @Post('onboarded')
  onboarded(@CurrentUser() user: AuthUser) {
    return this.profile.finishOnboarding(user.id);
  }
}
