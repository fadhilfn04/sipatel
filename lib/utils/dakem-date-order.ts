/**
 * Dana Kematian — Validasi Urutan Tanggal Workflow
 *
 * Prinsip: tanggal pada tahap berikutnya tidak boleh lebih awal dari tanggal
 * pada tahap sebelumnya (urutan kronologis proses pengajuan).
 *
 * Dipakai bersama oleh frontend (DanaKematianFormModal — UX) dan backend
 * (app/api/dana-kematian — source of truth). Perbandingan dilakukan pada
 * presisi hari (bagian waktu diabaikan).
 */

// Stage tanggal pada jalur utama workflow. Urutan array = urutan kronologis.
// Serah ke ahli waris sengaja TIDAK dimasukkan ke rantai utama karena pada
// alur existing `pusat_tanggal_selesai` kadang terisi saat verifikasi PP
// (verified → penyaluran) dan kadang baru terisi di akhir (aksi "Selesaikan"),
// sehingga urutan relatifnya ambigu terhadap serah ke ahli waris. Sebagai
// gantinya serah divalidasi lewat aturan tambahan (>= validasi, <= lapor).
export interface DakemDateStage {
  field: string;
  label: string;
}

export const DAKEM_DATE_STAGES: DakemDateStage[] = [
  { field: 'tanggal_meninggal', label: 'Tanggal Meninggal' },
  { field: 'tanggal_lapor_keluarga', label: 'Tanggal Lapor Keluarga' },
  { field: 'cabang_tanggal_awal_terima_berkas', label: 'Tanggal Input/Terima Berkas' },
  { field: 'cabang_tanggal_kirim_ke_pusat', label: 'Tanggal Kirim ke Pusat' },
  { field: 'pusat_tanggal_awal_terima', label: 'Tanggal Terima di Pusat' },
  { field: 'pusat_tanggal_validasi', label: 'Tanggal Validasi Pusat' },
  { field: 'pusat_tanggal_selesai', label: 'Tanggal Selesai Pusat' },
  { field: 'cabang_tanggal_lapor_ke_pusat', label: 'Tanggal Lapor ke Pusat' },
];

export interface DakemDateExtraRule {
  field: string;
  label: string;
  /** tanggal pada field tidak boleh lebih awal dari tanggal di daftar ini */
  mustNotBeBefore: string[];
  /** tanggal pada field tidak boleh lebih akhir dari tanggal di daftar ini */
  mustNotBeAfter: string[];
}

/** Aturan tambahan di luar rantai utama. */
export const DAKEM_DATE_EXTRA_RULES: DakemDateExtraRule[] = [
  {
    field: 'cabang_tanggal_serah_ke_ahli_waris',
    label: 'Tanggal Serah ke Ahli Waris',
    mustNotBeBefore: ['pusat_tanggal_validasi'],
    mustNotBeAfter: ['cabang_tanggal_lapor_ke_pusat'],
  },
];

export interface DateOrderError {
  field: string;
  message: string;
}

/**
 * Parse 'YYYY-MM-DD' (suffix waktu diabaikan) sebagai tanggal lokal.
 * Baris yang tidak valid dianggap tidak ada (bukan cakupan rule ini).
 */
function parseDateOnly(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || '').trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format 'YYYY-MM-DD' untuk pesan error. */
function formatDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Validasi urutan tanggal pengajuan.
 *
 * - Rantai utama: setiap tanggal tahap berikutnya >= tanggal tahap sebelumnya
 *   (hanya pasangan yang kedua-duanya terisi yang divalidasi).
 * - Aturan tambahan (serah ke ahli waris): >= validasi pusat dan <= lapor
 *   ke pusat.
 *
 * Return daftar error { field, message } — field dipakai untuk menampilkan
 * pesan di input yang bermasalah di frontend.
 */
export function validateDakemDateOrder(
  dates: Record<string, string | null | undefined>,
): DateOrderError[] {
  const errors: DateOrderError[] = [];
  const parsed: Record<string, Date | null> = {};

  for (const stage of DAKEM_DATE_STAGES) {
    parsed[stage.field] = parseDateOnly(dates[stage.field]);
  }
  for (const rule of DAKEM_DATE_EXTRA_RULES) {
    parsed[rule.field] = parseDateOnly(dates[rule.field]);
  }

  // Rantai utama: seluruh pasangan tahap (i < j) — tahap berikutnya tidak
  // boleh lebih awal dari tahap sebelumnya, termasuk saat ada tahap tengah
  // yang belum terisi (mis. tanggal_lapor_keluarga kosong).
  for (let i = 0; i < DAKEM_DATE_STAGES.length; i++) {
    const earlier = DAKEM_DATE_STAGES[i];
    const a = parsed[earlier.field];
    if (!a) continue;
    for (let j = i + 1; j < DAKEM_DATE_STAGES.length; j++) {
      const later = DAKEM_DATE_STAGES[j];
      const b = parsed[later.field];
      if (!b) continue;
      if (b.getTime() < a.getTime()) {
        errors.push({
          field: later.field,
          message: `${later.label} (${formatDate(b)}) tidak boleh lebih awal dari ${earlier.label} (${formatDate(a)}).`,
        });
      }
    }
  }

  // Aturan tambahan.
  const stageLabel = (field: string): string =>
    DAKEM_DATE_STAGES.find(s => s.field === field)?.label ?? field;

  for (const rule of DAKEM_DATE_EXTRA_RULES) {
    const target = parsed[rule.field];
    if (!target) continue;

    for (const beforeField of rule.mustNotBeBefore) {
      const before = parsed[beforeField];
      if (!before) continue;
      if (target.getTime() < before.getTime()) {
        errors.push({
          field: rule.field,
          message: `${rule.label} (${formatDate(target)}) tidak boleh lebih awal dari ${stageLabel(beforeField)} (${formatDate(before)}).`,
        });
      }
    }

    for (const afterField of rule.mustNotBeAfter) {
      const after = parsed[afterField];
      if (!after) continue;
      if (target.getTime() > after.getTime()) {
        errors.push({
          field: rule.field,
          message: `${rule.label} (${formatDate(target)}) tidak boleh lebih akhir dari ${stageLabel(afterField)} (${formatDate(after)}).`,
        });
      }
    }
  }

  return errors;
}

/** Gabungkan error urutan tanggal menjadi satu pesan (untuk pesan API). */
export function formatDateOrderErrors(errors: DateOrderError[]): string {
  return errors.map(e => e.message).join(' ');
}

/** Semua field tanggal yang terlibat validasi urutan (rantai + aturan tambahan). */
export function getDakemDateOrderFields(): string[] {
  const fields = DAKEM_DATE_STAGES.map(stage => stage.field);
  for (const rule of DAKEM_DATE_EXTRA_RULES) {
    if (!fields.includes(rule.field)) fields.push(rule.field);
  }
  return fields;
}

