"use client";

import type { ReactNode } from "react";
import { Track, type TrackMood } from "@/components/track/Track";

/**
 * Empty / no-data state dengan maskot Track.
 *
 * <EmptyState
 *   mood="idle"
 *   title="Belum ada transaksi"
 *   description="Catat pengeluaran pertamamu hari ini."
 * >
 *   <Button onClick={...}>Buat Target Baru</Button>
 * </EmptyState>
 */
export function EmptyState({
  mood = "idle",
  title,
  description,
  children,
}: {
  mood?: TrackMood;
  title: string;
  description?: string;
  /** Slot aksi opsional (tombol/Button apapun). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-card px-6 py-10 text-center shadow-card">
      <Track size={72} mood={mood} />
      <p className="text-body font-bold text-text">{title}</p>
      {description ? (
        <p className="max-w-[280px] text-small leading-relaxed text-text-subtle">{description}</p>
      ) : null}
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
