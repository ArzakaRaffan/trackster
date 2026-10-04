import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ReimbursementStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReimbursementService } from './reimbursement.service';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { MarkReceivedDto } from './dto/mark-received.dto';

@UseGuards(JwtAuthGuard)
@Controller('reimbursements')
export class ReimbursementController {
  constructor(private reimbursementService: ReimbursementService) {}

  @Get()
  list(@Query('status') status?: ReimbursementStatus) {
    return this.reimbursementService.list(status === 'RECEIVED' ? 'RECEIVED' : 'PENDING');
  }

  @Post()
  create(@Body() dto: CreateReimbursementDto) {
    return this.reimbursementService.create(dto);
  }

  @Post(':id/received')
  markReceived(@Param('id', ParseIntPipe) id: number, @Body() dto: MarkReceivedDto) {
    return this.reimbursementService.markReceived(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reimbursementService.remove(id);
  }
}
