/**
 * Dana Kematian — Konfigurasi Dinamis (server-side)
 *
 * Sumber tunggal konfigurasi yang dikelola admin pusat:
 *   - `max_death_claim_period_years` → batas maksimal pengajuan (tahun)
 *   - `required_documents`           → dokumen wajib/opsional (fileKey -> boolean)
 *
 * Nilai disimpan di tabel `dana_kematian_config` (migration 027) dan setiap
 * perubahan dicatat pada `dana_kematian_config_history`.
 *
 * Fallback: bila tabel belum ada / DB tidak dapat diakses, gunakan nilai
 * default di kode (lib/config/dana-kematian-config.ts & BERKAS_DOCUMENTS)
 * agar aplikasi tetap berjalan dan perilaku lama tidak berubah.
 */

import { supabaseAdmin } from '@/lib/supabase-storage';
import { MAX_DEATH_CLAIM_PERIOD_YEARS } from '@/lib/config/dana-kematian-config';
import { BERKAS_DOCUMENTS, BerkasRequiredOverride } from '@/lib/config/dana-kematian-berkas';

export const DAKEM_CONFIG_KEYS = {
  MAX_PERIOD_YEARS: 'max_death_claim_period_years',
  REQUIRED_DOCUMENTS: 'required_documents',
} as const;

export interface DakemConfigRow {
  key: string;
  label: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

/** Cache singkat agar tidak query DB pada setiap request. */
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

function getClient() {
  return supabaseAdmin;
}

/** Nilai default dokumen wajib dari konfigurasi statis (fallback). */
export function getDefaultRequiredDocumentMap(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const doc of BERKAS_DOCUMENTS) {
    map[doc.fileKey] = !!doc.requiredForLengkap;
  }
  return map;
}

/** Seluruh fileKey dokumen yang dikenal — membatasi konfigurasi admin. */
export function getKnownDocumentFileKeys(): string[] {
  return BERKAS_DOCUMENTS.map(doc => doc.fileKey);
}

/** Baca satu konfigurasi (dengan cache). Return null bila tidak tersedia. */
export async function getDakemConfigValue<T = unknown>(key: string): Promise<T | null> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('dana_kematian_config')
      .select('key, value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data) return null;

    cache.set(key, { value: data.value, expiresAt: Date.now() + CACHE_TTL_MS });
    return data.value as T;
  } catch {
    // Tabel belum dimigrasikan / DB tidak tersedia → fallback ke default.
    return null;
  }
}

/**
 * Batas maksimal jarak waktu (tahun) antara tanggal meninggal dan tanggal
 * pengajuan. Nilai diatur admin; fallback ke MAX_DEATH_CLAIM_PERIOD_YEARS (4).
 */
export async function getMaxDeathClaimPeriodYears(): Promise<number> {
  const raw = await getDakemConfigValue<unknown>(DAKEM_CONFIG_KEYS.MAX_PERIOD_YEARS);
  const parsed = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 && parsed <= 50) {
    return Math.floor(parsed);
  }
  return MAX_DEATH_CLAIM_PERIOD_YEARS;
}

/**
 * Override dokumen wajib/opsional dari konfigurasi admin.
 * Return objek yang siap dipakai `isBerkasLengkap(claim, options, override)`.
 */
export async function getRequiredDocumentOverride(): Promise<BerkasRequiredOverride> {
  const raw = await getDakemConfigValue<unknown>(DAKEM_CONFIG_KEYS.REQUIRED_DOCUMENTS);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const known = new Set(getKnownDocumentFileKeys());
  const requiredByFileKey: Record<string, boolean> = {};
  for (const [fileKey, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(fileKey)) continue; // abaikan key tak dikenal
    if (typeof value === 'boolean') requiredByFileKey[fileKey] = value;
  }

  return Object.keys(requiredByFileKey).length > 0 ? { requiredByFileKey } : {};
}

/** Validasi nilai batas tahun sebelum disimpan. */
export function validateMaxPeriodYears(value: unknown): { valid: boolean; value?: number; message?: string } {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    return { valid: false, message: 'Batas maksimal pengajuan harus berupa angka tahun.' };
  }
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    return { valid: false, message: 'Batas maksimal pengajuan harus bilangan bulat antara 1 dan 50 tahun.' };
  }
  return { valid: true, value: parsed };
}

/** Validasi peta dokumen wajib sebelum disimpan. */
export function validateRequiredDocuments(value: unknown): {
  valid: boolean;
  value?: Record<string, boolean>;
  message?: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, message: 'Konfigurasi dokumen wajib harus berupa objek fileKey -> boolean.' };
  }
  const known = new Set(getKnownDocumentFileKeys());
  const cleaned: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!known.has(key)) {
      return { valid: false, message: `Dokumen tidak dikenal: ${key}.` };
    }
    if (typeof val !== 'boolean') {
      return { valid: false, message: `Nilai untuk ${key} harus boolean (true/false).` };
    }
    cleaned[key] = val;
  }
  return { valid: true, value: cleaned };
}

/**
 * Simpan konfigurasi + catat riwayat perubahan (audit).
 * Otorisasi admin pusat dilakukan di API route, bukan di sini.
 */
export async function updateDakemConfig(params: {
  key: string;
  label: string;
  value: unknown;
  updatedBy: string;
  catatan?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const client = getClient();
  if (!client) {
    return { success: false, error: 'Supabase admin client tidak tersedia.' };
  }

  // Baca nilai sebelumnya untuk riwayat.
  const { data: existing, error: readError } = await client
    .from('dana_kematian_config')
    .select('key, value')
    .eq('key', params.key)
    .maybeSingle();

  if (readError && readError.code !== 'PGRST116') {
    return { success: false, error: readError.message };
  }

  const { error: upsertError } = await client
    .from('dana_kematian_config')
    .upsert(
      {
        key: params.key,
        label: params.label,
        value: params.value,
        updated_by: params.updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  const { error: historyError } = await client
    .from('dana_kematian_config_history')
    .insert({
      key: params.key,
      value_sebelum: existing?.value ?? null,
      value_setelah: params.value,
      updated_by: params.updatedBy,
      catatan: params.catatan || null,
    });

  if (historyError) {
    // Perubahan tetap tersimpan; riwayat gagal dicatat → dilaporkan agar terlihat.
    return { success: false, error: `Konfigurasi tersimpan tetapi riwayat gagal dicatat: ${historyError.message}` };
  }

  cache.delete(params.key);
  return { success: true };
}

/** Riwayat perubahan konfigurasi (terbaru lebih dulu). */
export async function getDakemConfigHistory(key?: string, limit = 50): Promise<any[]> {
  const client = getClient();
  if (!client) return [];
  try {
    let query = client
      .from('dana_kematian_config_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (key) query = query.eq('key', key);
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/** Test helper: bersihkan cache konfigurasi. */
export function __clearDakemConfigCache(): void {
  cache.clear();
}

