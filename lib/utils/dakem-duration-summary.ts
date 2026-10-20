/**
 * Dana Kematian — Ringkasan durasi proses.
 *
 * Tujuan: mendukung evaluasi proses (bukan pemeringkatan). TIDAK ada bobot
 * penilaian / skor — hanya durasi terukur per tahap agar keputusan bisnis
 * dapat diambil berdasarkan data.
 *
 * Sumber timestamp (kolom existing, lihat komentar migration 011):
 *   waktu_0  tanggal_lapor_keluarga          → laporan awal
 *   waktu_2  cabang_tanggal_kirim_ke_pusat   → submit ke Pusat
 *   waktu_3  pusat_tanggal_validasi          → selesai verifikasi Pusat
 *   waktu_4                                   → selesai pemrosesan Pusat
 *   waktu_5                                   → transfer dana
 *   waktu_6  cabang_tanggal_serah_ke_ahli_waris → serah ke ahli waris
 *   waktu_7  cabang_tanggal_lapor_ke_pusat   → laporan cabang selesai
 */

export interface DakemDurationClaim {
  id?: string;
  cabang_asal_melapor?: string | null;
  status_proses?: string | null;

  waktu_0?: string | null;
  waktu_2?: string | null;
  waktu_3?: string | null;
  waktu_4?: string | null;
  waktu_5?: string | null;
  waktu_6?: string | null;
  waktu_7?: string | null;

  tanggal_lapor_keluarga?: string | null;
  cabang_tanggal_kirim_ke_pusat?: string | null;
  pusat_tanggal_validasi?: string | null;
  cabang_tanggal_serah_ke_ahli_waris?: string | null;
  cabang_tanggal_lapor_ke_pusat?: string | null;
}

export interface DakemHistoryRow {
  status_dari?: string | null;
  status_ke?: string | null;
}

export interface DakemDurationSummary {
  /** Hari: laporan awal → submit ke Pusat (waktu proses cabang sebelum submit) */
  waktu_proses_cabang_hari: number | null;
  /** Hari: submit ke Pusat → selesai verifikasi Pusat (waktu tunggu Pusat) */
  waktu_tunggu_pusat_hari: number | null;
  /** Hari: verifikasi → selesai pemrosesan Pusat (bila tercatat) */
  pemrosesan_pusat_hari: number | null;
  /** Hari: selesai pemrosesan → serah ke ahli waris (bila tercatat) */
  penyaluran_hari: number | null;
  /** Hari: serah → laporan cabang selesai (bila tercatat) */
  pelaporan_hari: number | null;
  /** Hari: tahap terlama → tahap terakhir yang tercatat */
  durasi_keseluruhan_hari: number | null;
  /** Jumlah pengembalian untuk koreksi (pending_dokumen / revisi_pusat) */
  jumlah_koreksi: number;
  /** Timestamp terakhir yang tercatat (ISO) */
  tahap_terakhir: string | null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Selisih hari (dibulatkan) antara dua tanggal; null bila salah satu kosong. */
export function diffDays(start?: string | null, end?: string | null): number | null {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** Hitung ringkasan durasi satu pengajuan. */
export function getDakemDurationSummary(
  claim: DakemDurationClaim,
  history: DakemHistoryRow[] = [],
): DakemDurationSummary {
  const lapor = claim.waktu_0 || claim.tanggal_lapor_keluarga || null;
  const submit = claim.waktu_2 || claim.cabang_tanggal_kirim_ke_pusat || null;
  const verifikasi = claim.waktu_3 || claim.pusat_tanggal_validasi || null;
  const prosesSelesai = claim.waktu_4 || null;
  const transfer = claim.waktu_5 || null;
  const serah = claim.waktu_6 || claim.cabang_tanggal_serah_ke_ahli_waris || null;
  const laporan = claim.waktu_7 || claim.cabang_tanggal_lapor_ke_pusat || null;

  const timestamps = [lapor, submit, verifikasi, prosesSelesai, transfer, serah, laporan]
    .map(parseDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const first = timestamps[0] ?? null;
  const last = timestamps[timestamps.length - 1] ?? null;

  const jumlahKoreksi = history.filter(
    h => h.status_ke === 'pending_dokumen' || h.status_ke === 'revisi_pusat',
  ).length;

  return {
    waktu_proses_cabang_hari: diffDays(lapor, submit),
    waktu_tunggu_pusat_hari: diffDays(submit, verifikasi),
    pemrosesan_pusat_hari: diffDays(verifikasi, prosesSelesai),
    penyaluran_hari: diffDays(prosesSelesai || verifikasi, serah),
    pelaporan_hari: diffDays(serah, laporan),
    durasi_keseluruhan_hari:
      first && last ? Math.round((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)) : null,
    jumlah_koreksi: jumlahKoreksi,
    tahap_terakhir: last ? last.toISOString() : null,
  };
}

export interface DakemCabangDurationRecap {
  cabang: string;
  jumlah_pengajuan: number;
  jumlah_selesai: number;
  rata_rata_waktu_proses_cabang_hari: number | null;
  rata_rata_waktu_tunggu_pusat_hari: number | null;
  rata_rata_durasi_keseluruhan_hari: number | null;
  total_koreksi: number;
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10;
}

/**
 * Rekap durasi per cabang. Tidak ada skor/bobot/peringkat — hanya agregasi
 * durasi dan jumlah koreksi agar evaluasi cabang dapat dilakukan manusia.
 */
export function summarizeByCabang(
  claims: DakemDurationClaim[],
  historyByClaim: Record<string, DakemHistoryRow[]> = {},
): DakemCabangDurationRecap[] {
  const groups = new Map<string, DakemDurationClaim[]>();
  for (const claim of claims) {
    const cabang = claim.cabang_asal_melapor || '(tanpa cabang)';
    const list = groups.get(cabang) || [];
    list.push(claim);
    groups.set(cabang, list);
  }

  const recap: DakemCabangDurationRecap[] = [];
  for (const [cabang, list] of Array.from(groups.entries())) {
    const summaries = list.map(c =>
      getDakemDurationSummary(c, c.id ? historyByClaim[c.id] || [] : []),
    );
    recap.push({
      cabang,
      jumlah_pengajuan: list.length,
      jumlah_selesai: list.filter(c => c.status_proses === 'selesai').length,
      rata_rata_waktu_proses_cabang_hari: average(summaries.map(s => s.waktu_proses_cabang_hari)),
      rata_rata_waktu_tunggu_pusat_hari: average(summaries.map(s => s.waktu_tunggu_pusat_hari)),
      rata_rata_durasi_keseluruhan_hari: average(summaries.map(s => s.durasi_keseluruhan_hari)),
      total_koreksi: summaries.reduce((sum, s) => sum + s.jumlah_koreksi, 0),
    });
  }

  // Urutkan alfabetis — bukan peringkat.
  return recap.sort((a, b) => a.cabang.localeCompare(b.cabang));
}
