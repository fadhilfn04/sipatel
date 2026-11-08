/**
 * Audit Masking — fungsi murni untuk sanitasi nilai audit (tanpa I/O).
 *
 * Dipisahkan dari `audit-service.ts` (yang mengimpor Supabase/Prisma) agar
 * dapat diuji unit tanpa memicu koneksi database.
 */

/**
 * Kolom yang TIDAK BOLEH tersimpan plaintext di audit log (kredensial/token)
 * dan kolom yang wajib dimasking (rekening).
 */
export const EXCLUDED_KEYS = new Set([
  'password',
  'password_hash',
  'hashed_password',
  'token',
  'session_token',
  'refresh_token',
  'access_token',
  'id_token',
  'session_state',
  'secret',
  'api_key',
  'otp',
]);

export const MASKED_KEYS = new Set(['norek_bank', 'norek_bank_lama', 'nomor_rekening', 'nik']);

/** Masking nilai sensitif — konsisten dengan audit_mask_text() di database. */
export function maskAuditValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (text.trim() === '') return text;
  if (text.length <= 4) return '****';
  return `****${text.slice(-4)} (${text.length})`;
}

/** Bersihkan payload audit: buang kredensial, mask nilai sensitif. */
export function sanitizeAuditPayload(
  payload?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) return null;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (EXCLUDED_KEYS.has(key)) continue;
    if (MASKED_KEYS.has(key) && typeof value === 'string') {
      result[key] = maskAuditValue(value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

/** Hitung daftar field yang berubah (untuk aksi yang tidak lewat trigger). */
export function computeChangedFields(
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(oldValues || {})) {
    if (!keys.includes(key)) keys.push(key);
  }
  for (const key of Object.keys(newValues || {})) {
    if (!keys.includes(key)) keys.push(key);
  }

  const changed: string[] = [];
  for (const key of keys) {
    const before = JSON.stringify((oldValues || {})[key] ?? null);
    const after = JSON.stringify((newValues || {})[key] ?? null);
    if (before !== after) changed.push(key);
  }
  return changed.sort();
}
