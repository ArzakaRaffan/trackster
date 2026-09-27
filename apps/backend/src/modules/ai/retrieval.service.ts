import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

// Half-life 60 hari: pesan makin lama makin kurang relevan meski skor teks-nya tinggi.
const RECENCY_HALF_LIFE_DAYS = 60;
const SNIPPET_MAX_CHARS = 300;

export interface RetrievedMessage {
  id: number;
  threadId: number;
  threadTitle: string | null;
  role: string;
  createdAt: Date;
  snippet: string;
}

interface RawRow {
  id: number;
  threadId: number;
  threadTitle: string | null;
  role: string;
  createdAt: Date;
  snippet: string;
}

@Injectable()
export class RetrievalService {
  constructor(private prisma: PrismaService) {}

  /** Cari pesan lama (blok [4] system prompt / tool searchPastConversations) via Postgres FTS.
   *  `excludeThreadId` + `excludeAfterId`: kecualikan pesan thread aktif yang sudah masuk window
   *  history (id > excludeAfterId) — pesan lama thread yang sama (di luar window) tetap kandidat. */
  async search(
    query: string,
    opts: { excludeThreadId?: number; excludeAfterId?: number; limit?: number } = {},
  ): Promise<RetrievedMessage[]> {
    const q = query.trim();
    if (!q) return [];
    const limit = opts.limit ?? 5;

    const rows = await this.prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        cm.id AS "id",
        cm."threadId" AS "threadId",
        ct.title AS "threadTitle",
        cm.role AS "role",
        cm."createdAt" AS "createdAt",
        ts_headline(
          'indonesian', cm.content, websearch_to_tsquery('indonesian', ${q}),
          'MaxWords=40, MinWords=15, MaxFragments=1'
        ) AS "snippet"
      FROM "ChatMessage" cm
      JOIN "ChatThread" ct ON ct.id = cm."threadId"
      WHERE cm.search @@ websearch_to_tsquery('indonesian', ${q})
        AND cm.role IN ('user', 'assistant')
        AND cm.content <> ''
        AND NOT (
          ${opts.excludeThreadId ?? null}::int IS NOT NULL
          AND cm."threadId" = ${opts.excludeThreadId ?? null}::int
          AND cm.id > ${opts.excludeAfterId ?? 0}::int
        )
      ORDER BY
        ts_rank_cd(cm.search, websearch_to_tsquery('indonesian', ${q}))
          * exp(-ln(2) * extract(epoch FROM (now() - cm."createdAt")) / (${RECENCY_HALF_LIFE_DAYS} * 86400))
        DESC
      LIMIT ${limit}
    `);

    return rows.map((r) => ({
      ...r,
      snippet: r.snippet.length > SNIPPET_MAX_CHARS ? `${r.snippet.slice(0, SNIPPET_MAX_CHARS)}…` : r.snippet,
    }));
  }

  /** Teks buat blok [4] system prompt — kosong kalau tidak ada hasil (jangan suntik section kosong). */
  formatForPrompt(results: RetrievedMessage[]): string {
    if (results.length === 0) return '';
    return results
      .map((r) => {
        const date = r.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const title = r.threadTitle ? ` (${r.threadTitle})` : '';
        return `- [${date}${title}] ${r.snippet}`;
      })
      .join('\n');
  }
}
