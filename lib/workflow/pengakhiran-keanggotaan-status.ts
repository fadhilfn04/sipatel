/**
 * Pengakhiran Keanggotaan — Central status configuration
 *
 * Single source of truth untuk nilai status, label tampilan, badge variant,
 * urutan alur, dan transisi yang diizinkan. UI dan API derive dari sini.
 *
 * Workflow (2 tahap — pola Mutasi Cabang):
 *   menunggu ──────────────┬→ diverifikasi_pc ──┬→ disetujui_pp (terminal, apply status berhenti)
 *                           │                    ├→ ditolak      (terminal)
 *                           │                    └→ dibatalkan   (terminal)
 *                           └→ ditolak / dibatalkan (terminal)
 */

import type { PengakhiranStatus } from '@/lib/supabase';

export type PengakhiranBadgeVariant =
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'secondary';

export interface PengakhiranStatusConfig {
  value: PengakhiranStatus | 'unknown';
  label: string;
  variant: PengakhiranBadgeVariant;
  /** Posisi pada alur happy-path */
  order: number;
  /** Tidak ada transisi lanjutan */
  terminal: boolean;
}

export const PENGAKHIRAN_STATUSES: PengakhiranStatusConfig[] = [
  { value: 'menunggu',        label: 'Menunggu Verifikasi', variant: 'warning',     order: 0, terminal: false },
  { value: 'diverifikasi_pc', label: 'Verifikasi PC',        variant: 'info',       order: 1, terminal: false },
  { value: 'disetujui_pp',    label: 'Disetujui PP',         variant: 'success',    order: 2, terminal: true },
  { value: 'ditolak',         label: 'Ditolak',              variant: 'destructive', order: -1, terminal: true },
  { value: 'dibatalkan',      label: 'Dibatalkan',           variant: 'secondary',  order: -1, terminal: true },
];

const STATUS_MAP = new Map<string, PengakhiranStatusConfig>(
  PENGAKHIRAN_STATUSES.map((s) => [String(s.value), s]),
);

const UNKNOWN_STATUS: PengakhiranStatusConfig = {
  value: 'unknown',
  label: 'unknown',
  variant: 'secondary',
  order: -1,
  terminal: false,
};

export function getPengakhiranStatusConfig(
  status: string | null | undefined,
): PengakhiranStatusConfig {
  if (!status) return UNKNOWN_STATUS;
  return STATUS_MAP.get(status) ?? { ...UNKNOWN_STATUS, label: status, value: status as PengakhiranStatus };
}

/** Badge props untuk sebuah status (label + variant). */
export function getPengakhiranStatusProps(status: string | null | undefined): {
  label: string;
  variant: PengakhiranBadgeVariant;
} {
  const config = getPengakhiranStatusConfig(status);
  return { label: config.label, variant: config.variant };
}

/** Opsi filter dropdown (urut sesuai alur). */
export const PENGAKHIRAN_STATUS_FILTER_OPTIONS = PENGAKHIRAN_STATUSES;

/** Status yang masih berjalan — satu pengajuan aktif per anggota. */
export const PENGAKHIRAN_ACTIVE_STATUSES: readonly PengakhiranStatus[] = [
  'menunggu',
  'diverifikasi_pc',
];

/** Transisi status yang diizinkan (dipakai frontend & backend). */
export const PENGAKHIRAN_TRANSITIONS: Record<PengakhiranStatus, PengakhiranStatus[]> = {
  menunggu: ['diverifikasi_pc', 'ditolak', 'dibatalkan'],
  diverifikasi_pc: ['disetujui_pp', 'ditolak', 'dibatalkan'],
  disetujui_pp: [],
  ditolak: [],
  dibatalkan: [],
};

export function isValidPengakhiranTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from || !to) return false;
  const allowed = PENGAKHIRAN_TRANSITIONS[from as PengakhiranStatus];
  if (!allowed) return false;
  return allowed.includes(to as PengakhiranStatus);
}

/** Pengajuan masih aktif (menunggu / diverifikasi PC). */
export function isPengakhiranActive(status: string | null | undefined): boolean {
  return (PENGAKHIRAN_ACTIVE_STATUSES as readonly string[]).includes(status || '');
}

/** Status yang masih bisa dibatalkan oleh pengaju. */
export function isPengakhiranCancelable(status: string | null | undefined): boolean {
  return isPengakhiranActive(status);
}

/** Status final — tidak dapat diubah lagi. */
export function isPengakhiranTerminal(status: string | null | undefined): boolean {
  return getPengakhiranStatusConfig(status).terminal;
}
