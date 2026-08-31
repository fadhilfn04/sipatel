/**
 * Dana Kematian — Central status configuration
 *
 * Single source of truth for status values, display labels, badge variants,
 * and flow ordering. UI components MUST derive status labels/badges from here
 * instead of maintaining their own maps.
 *
 * Workflow (UAT 2026):
 *   Draft → Verifikasi Pusat → ┌ Koreksi (return to PC, resubmit)
 *                              ├ Batal      (terminal, stays in list)
 *                              ├ Ditolak    (terminal)
 *                              └ Valid → Penyaluran → Terima Ahli Waris
 *                                      → Laporan → Selesai
 *
 * Legacy statuses (dilaporkan, verifikasi_cabang, pending_dokumen,
 * revisi_pusat) still exist on old rows and are displayed under the new
 * flow labels without any data migration.
 */

export type DakemBadgeVariant = 'success' | 'warning' | 'destructive' | 'secondary';

export interface DakemStatusConfig {
  value: string;
  label: string;
  variant: DakemBadgeVariant;
  /** Position in the happy-path flow (legacy statuses share their target stage) */
  order: number;
  /** No further transitions allowed */
  terminal: boolean;
  /** Legacy value kept for old rows — not offered for new submissions */
  legacy?: boolean;
}

export const DAKEM_STATUSES: DakemStatusConfig[] = [
  { value: 'draft',              label: 'Draft',              variant: 'secondary',   order: 0, terminal: false },
  // Legacy pre-submission states are displayed under the Draft stage
  { value: 'dilaporkan',         label: 'Draft',              variant: 'secondary',   order: 0, terminal: false, legacy: true },
  { value: 'verifikasi_cabang',  label: 'Draft',              variant: 'secondary',   order: 0, terminal: false, legacy: true },
  { value: 'proses_pusat',       label: 'Verifikasi Pusat',   variant: 'warning',     order: 1, terminal: false },
  // Koreksi = PP returned the berkas for correction
  { value: 'pending_dokumen',    label: 'Koreksi',            variant: 'destructive', order: 1, terminal: false, legacy: true },
  { value: 'revisi_pusat',       label: 'Koreksi',            variant: 'destructive', order: 1, terminal: false, legacy: true },
  { value: 'batal',              label: 'Batal',              variant: 'destructive', order: -1, terminal: true },
  { value: 'ditolak',            label: 'Ditolak',            variant: 'destructive', order: -1, terminal: true },
  { value: 'verified',           label: 'Valid',              variant: 'success',     order: 2, terminal: false },
  { value: 'penyaluran',         label: 'Penyaluran',         variant: 'warning',     order: 3, terminal: false },
  { value: 'terima_ahli_waris',  label: 'Terima Ahli Waris',  variant: 'warning',     order: 4, terminal: false },
  { value: 'laporan',            label: 'Laporan',            variant: 'warning',     order: 5, terminal: false },
  { value: 'selesai',            label: 'Selesai',            variant: 'success',     order: 6, terminal: true },
];

const STATUS_MAP = new Map(DAKEM_STATUSES.map(s => [s.value, s]));

/** Fallback for unknown values so badges never render `undefined` */
const UNKNOWN_STATUS: DakemStatusConfig = {
  value: 'unknown',
  label: 'unknown',
  variant: 'secondary',
  order: -1,
  terminal: false,
};

export function getDakemStatus(status: string | null | undefined): DakemStatusConfig {
  if (!status) return UNKNOWN_STATUS;
  return STATUS_MAP.get(status) ?? { ...UNKNOWN_STATUS, label: status, value: status };
}

/**
 * Badge props for a status. Legacy values resolve to their new-flow label.
 */
export function getStatusProps(status: string | null | undefined): {
  label: string;
  variant: DakemBadgeVariant;
} {
  const config = getDakemStatus(status);
  return { label: config.label, variant: config.variant };
}

/** Filter dropdown options (excludes legacy values; ordered by flow) */
export const STATUS_FILTER_OPTIONS = DAKEM_STATUSES.filter(s => !s.legacy);

/** Statuses whose submissions can still be dibatalkan (canceled) */
export const CANCELABLE_STATUSES = [
  'draft',
  'dilaporkan',
  'verifikasi_cabang',
  'pending_dokumen',
  'revisi_pusat',
] as const;

/** Terminal statuses — no further editing or actions */
export const TERMINAL_STATUSES = [
  'selesai',
  'batal',
  'ditolak',
] as const;

export function isCancelable(status: string | null | undefined): boolean {
  return (CANCELABLE_STATUSES as readonly string[]).includes(status || '');
}

/** Editable = not in a terminal state (selesai / batal / ditolak) */
export function isEditable(status: string | null | undefined): boolean {
  return !(TERMINAL_STATUSES as readonly string[]).includes(status || '');
}

/**
 * Module integration links for the final workflow stages.
 * - Finance module receives the berkas serah terima (Terima Ahli Waris stage).
 * - Archive Management receives the branch report (Laporan stage).
 * TODO: ARCHIVE_MODULE_URL points at the future Arsip module route — update
 * once that module ships.
 */
export const FINANCE_MODULE_URL = '/keuangan/laporan-keuangan/dana-kematian';
export const ARCHIVE_MODULE_URL = '/arsip/dana-kematian';

/**
 * The 6 mandatory document fields that gate "Berkas Lengkap".
 * SK Pensiun can alternatively be satisfied by the lost-document statement
 * (document_metadata.sk_pensiun_missing + explanation) — handled in the form.
 */
export const MANDATORY_DOC_FIELDS = [
  'file_sk_pensiun',
  'file_surat_kematian',
  'file_surat_pernyataan_ahli_waris',
  'file_kartu_keluarga',
  'file_e_ktp',
  'file_surat_keterangan',
] as const;
