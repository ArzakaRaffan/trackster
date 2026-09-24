import { ParseStatus } from '@prisma/client';

/** Status terakhir menang di EmailParseLog, KECUALI email itu sudah RECORDED — re-scan (backfill
 * ulang, dsb) yang berakhir DUPLICATE/dsb tidak boleh menimpa jejak bahwa email itu sudah tercatat. */
export function shouldSkipLogUpsert(existingStatus: ParseStatus | null): boolean {
  return existingStatus === ParseStatus.RECORDED;
}
