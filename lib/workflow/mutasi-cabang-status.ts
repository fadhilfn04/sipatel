/**
 * Mutasi Cabang — Central status configuration
 *
 * Single source of truth untuk nilai status, label tampilan, badge variant,
 * urutan alur, dan transisi yang diizinkan. UI dan API derive dari sini,
 * bukan memelihara map masing-masing.
 *
 * Workflow:
 *   menunggu ──────────────┬→ diverifikasi_pc ──┬→ disetujui_pp (terminal)
 *                           │                    ├→ ditolak      (terminal)
 *                           │                    └→ dibatalkan   (terminal)
 *                           └→ ditolak / dibatalkan (terminal)
 *
 * Verifikasi PC/PP: endpoint PATCH dilindungi permission manage_keanggotaan;
 * pembatalan (dibatalkan) juga boleh dilakukan pengaju selama masih aktif.
 */

export type MutasiCabangStatusValue =
  | 'menunggu'
  | 'diverifikasi_pc'
  | 'disetujui_pp'
  | 'ditolak'
  | 'dibatalkan';

export type MutasiCabangBadgeVariant =
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'secondary';

export interface MutasiCabangStatusConfig {
  value: MutasiCabangStatusValue | 'unknown';
  label: string;
  variant: MutasiCabangBadgeVariant;
  /** Posisi pada alur happy-path */
  order: number;
  /** Tidak ada transisi lanjutan */
  terminal: boolean;
}

export const MUTASI_CABANG_STATUSES: MutasiCabangStatusConfig[] = [
  { value: 'menunggu',        label: 'Menunggu Verifikasi', variant: 'warning',     order: 0, terminal: false },
  { value: 'diverifikasi_pc', label: 'Verifikasi PC',        variant: 'info',       order: 1, terminal: false },
  { value: 'disetujui_pp',    label: 'Disetujui PP',         variant: 'success',    order: 2, terminal: true },
  { value: 'ditolak',         label: 'Ditolak',              variant: 'destructive',order: -1, terminal: true },
  { value: 'dibatalkan',      label: 'Dibatalkan',           variant: 'secondary',  order: -1, terminal: true },
];

const STATUS_MAP = new Map(MUTASI_CABANG_STATUSES.map((s) => [s.value, s]));

const UNKNOWN_STATUS: MutasiCabangStatusConfig = {
  value: 'unknown',
  label: 'unknown',
  variant: 'secondary',
  order: -1,
  terminal: false,
};

export function getMutasiCabangStatusConfig(
  status: string | null | undefined,
): MutasiCabangStatusConfig {
  if (!status) return UNKNOWN_STATUS;
  return STATUS_MAP.get(status as MutasiCabangStatusValue) ?? { ...UNKNOWN_STATUS, label: status, value: status as MutasiCabangStatusValue };
}

/** Badge props untuk sebuah status (label + variant). */
export function getMutasiCabangStatusProps(status: string | null | undefined): {
  label: string;
  variant: MutasiCabangBadgeVariant;
} {
  const config = getMutasiCabangStatusConfig(status);
  return { label: config.label, variant: config.variant };
}

/** Opsi filter dropdown (urut sesuai alur). */
export const MUTASI_CABANG_STATUS_FILTER_OPTIONS = MUTASI_CABANG_STATUSES;

/** Status yang masih berjalan — satu pengajuan aktif per anggota. */
export const MUTASI_CABANG_ACTIVE_STATUSES: readonly MutasiCabangStatusValue[] = [
  'menunggu',
  'diverifikasi_pc',
];

/** Transisi status yang diizinkan (dipakai frontend & backend). */
export const MUTASI_CABANG_TRANSITIONS: Record<MutasiCabangStatusValue, MutasiCabangStatusValue[]> = {
  menunggu: ['diverifikasi_pc', 'ditolak', 'dibatalkan'],
  diverifikasi_pc: ['disetujui_pp', 'ditolak', 'dibatalkan'],
  disetujui_pp: [],
  ditolak: [],
  dibatalkan: [],
};

export function isValidMutasiCabangTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from || !to) return false;
  const allowed = MUTASI_CABANG_TRANSITIONS[from as MutasiCabangStatusValue];
  if (!allowed) return false;
  return allowed.includes(to as MutasiCabangStatusValue);
}

/** Pengajuan masih aktif (menunggu / diverifikasi PC). */
export function isMutasiCabangActive(status: string | null | undefined): boolean {
  return (MUTASI_CABANG_ACTIVE_STATUSES as readonly string[]).includes(status || '');
}

/** Status yang masih bisa dibatalkan oleh pengaju. */
export function isMutasiCabangCancelable(status: string | null | undefined): boolean {
  return isMutasiCabangActive(status);
}

/** Status final — tidak dapat diubah lagi. */
export function isMutasiCabangTerminal(status: string | null | undefined): boolean {
  return getMutasiCabangStatusConfig(status).terminal;
}
