import { Module } from '@nestjs/common';
import { MerchantAliasController } from './merchant-alias.controller';
import { MerchantAliasService } from './merchant-alias.service';
import { PrismaService } from '../../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MerchantAliasController],
  providers: [MerchantAliasService, PrismaService],
  exports: [MerchantAliasService],
})
export class MerchantAliasModule {}
