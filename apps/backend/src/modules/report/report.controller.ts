import { BadRequestException, Controller, Get, Query, UseGuards, Res, Header } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { startOfWibDay, addWibDays, wibDateKey } from '../../common/wib';
import { Response } from 'express';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Sel CSV teks. Deskripsi berasal dari email bank (bisa dipalsukan): awalan = + - @ tab CR dinetralkan dengan ' supaya
 * Excel/Sheets tidak mengeksekusinya sebagai formula (CSV/formula injection). */
export const csvText = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  /** `?period=week|month&date=YYYY-MM-DD` (default: sekarang, WIB). `date` cukup jatuh di dalam periode. */
  @Get()
  async getReport(@CurrentUser() user: AuthUser, @Query('period') period = 'week', @Query('date') date?: string) {
    if (period !== 'week' && period !== 'month') throw new BadRequestException('period harus week|month');
    const anchor = date ? startOfWibDay(date) : new Date();
    return this.reportService.getReport(user.id, period, anchor);
  }

  @Get('aggregate')
  async getAggregate(@CurrentUser() user: AuthUser, @Query('period') period = '6m', @Query('date') date?: string) {
    if (period !== '6m' && period !== 'all') throw new BadRequestException('period harus 6m|all');
    const anchor = date ? startOfWibDay(date) : new Date();
    return this.reportService.getAggregate(user.id, period, anchor);
  }

  @Get('records')
  async getRecords(@CurrentUser() user: AuthUser) {
    return this.reportService.getRecords(user.id);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw new BadRequestException('from/to harus YYYY-MM-DD');
    const fromDate = from ? startOfWibDay(from) : addWibDays(startOfWibDay(new Date()), -30);
    const toDate = to ? addWibDays(startOfWibDay(to), 1) : addWibDays(startOfWibDay(new Date()), 1);
    const rows = await this.reportService.getDataExportRows(user.id, fromDate, toDate);
    
    const filename = `trackster-${from ?? 'all'}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    
    const header = 'tanggal,deskripsi,jumlah,kategori,rekening,catatan';
    const lines = rows.map(r =>
      [
        wibDateKey(r.occurredAt),
        csvText(r.description),
        Number(r.amount),
        r.category,
        r.source,
        csvText(r.note ?? ''),
      ].join(',')
    );
    
    res.end([header, ...lines].join('\n'));
  }
}
