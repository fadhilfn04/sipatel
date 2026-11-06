/**
 * Perubahan Kepengurusan — Central status configuration
 *
 * Single source of truth untuk nilai status, label tampilan, badge variant,
 * urutan alur, dan transisi yang diizinkan. UI dan API derive dari sini.
 *
 * Workflow (2 tahap — pola Pengakhiran Keanggotaan / Mutasi Cabang):
 *   menunggu ──────────────┬→ diverifikasi_pc ──┬→ disetujui_pp (terminal, apply + sync posisi)
 *                           │                    ├→ ditolak      (terminal)
 *                           │                    └→ dibatalkan   (terminal)
 *                           └→ ditolak / dibatalkan (terminal)
 */

import type { KepengurusanStatus } from '@/lib/supabase';

export type KepengurusanBadgeVariant =
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'secondary';

export interface KepengurusanStatusConfig {
  value: KepengurusanStatus | 'unknown';
  label: string;
  variant: KepengurusanBadgeVariant;
  /** Posisi pada alur happy-path */
  order: number;
  /** Tidak ada transisi lanjutan */
  terminal: boolean;
}

export const KEPENGURUSAN_STATUSES: KepengurusanStatusConfig[] = [
  { value: 'menunggu',        label: 'Menunggu Verifikasi', variant: 'warning',      order: 0, terminal: false },
  { value: 'diverifikasi_pc', label: 'Verifikasi PC',        variant: 'info',        order: 1, terminal: false },
  { value: 'disetujui_pp',    label: 'Disetujui PP',         variant: 'success',     order: 2, terminal: true },
  { value: 'ditolak',         label: 'Ditolak',              variant: 'destructive', order: -1, terminal: true },
  { value: 'dibatalkan',      label: 'Dibatalkan',           variant: 'secondary',   order: -1, terminal: true },
];

const STATUS_MAP = new Map<string, KepengurusanStatusConfig>(
  KEPENGURUSAN_STATUSES.map((s) => [String(s.value), s]),
);

const UNKNOWN_STATUS: KepengurusanStatusConfig = {
  value: 'unknown',
  label: 'unknown',
  variant: 'secondary',
  order: -1,
  terminal: false,
};

export function getKepengurusanStatusConfig(
  status: string | null | undefined,
): KepengurusanStatusConfig {
  if (!status) return UNKNOWN_STATUS;
  return STATUS_MAP.get(status) ?? { ...UNKNOWN_STATUS, label: status, value: status as KepengurusanStatus };
}

/** Badge props untuk sebuah status (label + variant). */
export function getKepengurusanStatusProps(status: string | null | undefined): {
  label: string;
  variant: KepengurusanBadgeVariant;
} {
  const config = getKepengurusanStatusConfig(status);
  return { label: config.label, variant: config.variant };
}

/** Opsi filter dropdown (urut sesuai alur). */
export const KEPENGURUSAN_STATUS_FILTER_OPTIONS = KEPENGURUSAN_STATUSES;

/** Status yang masih berjalan — satu pengajuan aktif per anggota. */
export const KEPENGURUSAN_ACTIVE_STATUSES: readonly KepengurusanStatus[] = [
  'menunggu',
  'diverifikasi_pc',
];

/** Transisi status yang diizinkan (dipakai frontend & backend). */
export const KEPENGURUSAN_TRANSITIONS: Record<KepengurusanStatus, KepengurusanStatus[]> = {
  menunggu: ['diverifikasi_pc', 'ditolak', 'dibatalkan'],
  diverifikasi_pc: ['disetujui_pp', 'ditolak', 'dibatalkan'],
  disetujui_pp: [],
  ditolak: [],
  dibatalkan: [],
};

export function isValidKepengurusanTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from || !to) return false;
  const allowed = KEPENGURUSAN_TRANSITIONS[from as KepengurusanStatus];
  if (!allowed) return false;
  return allowed.includes(to as KepengurusanStatus);
}

/** Pengajuan masih aktif (menunggu / diverifikasi PC). */
export function isKepengurusanActive(status: string | null | undefined): boolean {
  return (KEPENGURUSAN_ACTIVE_STATUSES as readonly string[]).includes(status || '');
}

/** Status yang masih bisa dibatalkan. */
export function isKepengurusanCancelable(status: string | null | undefined): boolean {
  return isKepengurusanActive(status);
}

/** Status final — tidak dapat diubah lagi. */
export function isKepengurusanTerminal(status: string | null | undefined): boolean {
  return getKepengurusanStatusConfig(status).terminal;
}
