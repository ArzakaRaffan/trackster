import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Source } from '@prisma/client';
import { UpdateNoteDto } from './dto/update-note.dto';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('source') source?: Source,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionService.findAll({
      startDate,
      endDate,
      source,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('weekly')
  async getWeekly() {
    return this.transactionService.getWeekly();
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.transactionService.remove(id);
  }

  @Patch(':id/note')
  async updateNote(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto) {
    return this.transactionService.updateNote(id, dto.note);
  }
}
