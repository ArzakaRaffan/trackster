import { Module } from '@nestjs/common';
import { ApiTokenController } from './api-token.controller';
import { ApiTokenService } from './api-token.service';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [ApiTokenController],
  providers: [ApiTokenService, ApiTokenGuard, PrismaService],
  exports: [ApiTokenService, ApiTokenGuard],
})
export class ApiTokenModule {}
