import { PrismaClient } from '@prisma/client';

/** Sapaan user di prompt AI: displayName → username. Pengganti "Arzaka" yang dulu hardcode. */
export async function getUserName(prisma: Pick<PrismaClient, 'user'>, userId: number): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, username: true } });
  return u?.displayName?.trim() || u?.username || 'kamu';
}

/** Prompt AI masih ditulis dengan placeholder "Arzaka" (teks asli); ganti dengan nama user yang sedang dilayani. */
export const forUser = (prompt: string, name: string): string => prompt.replace(/Arzaka/g, name);
