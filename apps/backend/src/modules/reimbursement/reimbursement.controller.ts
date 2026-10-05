import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ReimbursementStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReimbursementService } from './reimbursement.service';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { MarkReceivedDto } from './dto/mark-received.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('reimbursements')
export class ReimbursementController {
  constructor(private reimbursementService: ReimbursementService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: ReimbursementStatus, @Query('transactionId') transactionId?: string) {
    return this.reimbursementService.list(user.id, status === 'RECEIVED' ? 'RECEIVED' : 'PENDING', transactionId ? parseInt(transactionId, 10) : undefined);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReimbursementDto) {
    return this.reimbursementService.create(user.id, dto);
  }

  @Post(':id/received')
  markReceived(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: MarkReceivedDto) {
    return this.reimbursementService.markReceived(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.reimbursementService.remove(user.id, id);
  }
}
