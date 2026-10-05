import { Injectable, NotFoundException } from '@nestjs/common';
import { MemoryKind } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

const VALID_KINDS: MemoryKind[] = ['PROFILE', 'GOAL', 'PLAN', 'PREFERENCE', 'CONCERN', 'EVENT', 'DECISION'];
const MAX_OPS_PER_TURN = 3;

export type MemoryOp =
  | { op: 'add'; kind: MemoryKind; content: string; importance?: number; validUntil?: string }
  | { op: 'update'; id: number; kind?: MemoryKind; content?: string; importance?: number; validUntil?: string }
  | { op: 'archive'; id: number };

function clampImportance(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 2;
  return Math.min(3, Math.max(1, Math.round(v)));
}

/** Parse & validasi output JSON model ekstraksi (untrusted — model bisa halusinasi field/format).
 * Entry yang nggak valid di-skip diam-diam (bukan gagal semua), dibatasi 3 operasi per giliran
 * sesuai desain di epic. Pure function, dites di ai-memory.check.ts tanpa DB/AI call. */
export function parseMemoryOps(raw: string): MemoryOp[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const ops: MemoryOp[] = [];
  for (const item of parsed.slice(0, MAX_OPS_PER_TURN) as any[]) {
    if (!item || typeof item !== 'object') continue;

    if (item.op === 'add') {
      if (typeof item.content !== 'string' || !item.content.trim()) continue;
      if (!VALID_KINDS.includes(item.kind)) continue;
      ops.push({
        op: 'add',
        kind: item.kind,
        content: item.content.trim(),
        importance: clampImportance(item.importance),
        ...(typeof item.validUntil === 'string' ? { validUntil: item.validUntil } : {}),
      });
    } else if (item.op === 'update') {
      if (typeof item.id !== 'number') continue;
      ops.push({
        op: 'update',
        id: item.id,
        ...(VALID_KINDS.includes(item.kind) ? { kind: item.kind } : {}),
        ...(typeof item.content === 'string' && item.content.trim() ? { content: item.content.trim() } : {}),
        ...(item.importance != null ? { importance: clampImportance(item.importance) } : {}),
        ...(typeof item.validUntil === 'string' ? { validUntil: item.validUntil } : {}),
      });
    } else if (item.op === 'archive') {
      if (typeof item.id !== 'number') continue;
      ops.push({ op: 'archive', id: item.id });
    }
  }
  return ops;
}

@Injectable()
export class AiMemoryService {
  constructor(private prisma: PrismaService) {}

  /** Memory aktif buat disuntik ke system prompt — importance tinggi & terbaru dulu, maks `limit`.
   * `validUntil` yang lewat diarsip otomatis di sini (bukan cron terpisah — cukup murah dicek tiap panggil). */
  async listActive(userId: number, limit = 40) {
    const now = new Date();
    await this.prisma.aiMemory.updateMany({
      where: { userId, archivedAt: null, validUntil: { lt: now } },
      data: { archivedAt: now },
    });
    return this.prisma.aiMemory.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  /** Semua memory (termasuk yang di-archive) buat halaman "Yang Track ingat". */
  async listAll(userId: number) {
    return this.prisma.aiMemory.findMany({
      where: { userId },
      orderBy: [{ archivedAt: 'asc' }, { importance: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: number, data: { kind: MemoryKind; content: string; importance?: number; validUntil?: string; sourceMessageId?: number }) {
    return this.prisma.aiMemory.create({
      data: {
        userId,
        kind: data.kind,
        content: data.content,
        importance: data.importance ?? 2,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        sourceMessageId: data.sourceMessageId,
      },
    });
  }

  async update(
    userId: number,
    id: number,
    data: Partial<{ kind: MemoryKind; content: string; importance: number; validUntil: string | null; archived: boolean }>,
  ) {
    await this.assertExists(userId, id);
    await this.prisma.aiMemory.updateMany({
      where: { id, userId },
      data: {
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.importance !== undefined ? { importance: data.importance } : {}),
        ...(data.validUntil !== undefined ? { validUntil: data.validUntil ? new Date(data.validUntil) : null } : {}),
        ...(data.archived !== undefined ? { archivedAt: data.archived ? new Date() : null } : {}),
      },
    });
    return this.prisma.aiMemory.findFirstOrThrow({ where: { id, userId } });
  }

  async remove(userId: number, id: number) {
    await this.assertExists(userId, id);
    await this.prisma.aiMemory.deleteMany({ where: { id, userId } });
  }

  /** Terapkan hasil ekstraksi AI — dipanggil fire-and-forget dari AiChatService, atau tool remember/forget. */
  async applyOps(userId: number, ops: MemoryOp[], sourceMessageId?: number) {
    for (const op of ops) {
      if (op.op === 'add') {
        await this.create(userId, { ...op, sourceMessageId });
      } else if (op.op === 'update') {
        const exists = await this.prisma.aiMemory.findFirst({ where: { id: op.id, userId } });
        if (!exists) continue;
        await this.update(userId, op.id, { kind: op.kind, content: op.content, importance: op.importance, validUntil: op.validUntil });
      } else if (op.op === 'archive') {
        const exists = await this.prisma.aiMemory.findFirst({ where: { id: op.id, userId } });
        if (!exists) continue;
        await this.update(userId, op.id, { archived: true });
      }
    }
  }

  /** Teks buat blok [3] system prompt. */
  formatForPrompt(memories: { kind: string; content: string }[]): string {
    if (memories.length === 0) return '';
    return memories.map((m) => `- [${m.kind}] ${m.content}`).join('\n');
  }

  private async assertExists(userId: number, id: number) {
    const row = await this.prisma.aiMemory.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(`Memory ${id} tidak ditemukan`);
    return row;
  }
}
