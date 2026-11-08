/**
 * Audit Service — penulisan audit untuk aksi NON-CRUD & bridging SystemLog.
 *
 * Perubahan data biasa (INSERT/UPDATE/DELETE) dicatat OTOMATIS oleh trigger
 * database `audit_log_row()` (migration 036) — developer tidak perlu menambah
 * kode audit di setiap fitur. Service ini dipakai untuk:
 *  1. Aksi workflow yang tidak mengubah baris data bisnis langsung
 *     (APPROVE, REJECT, VERIFY, LOGIN, LOGOUT).
 *  2. Bridging log lama `SystemLog` (Prisma, user-management) ke `audit_log`
 *     agar seluruh riwayat dapat dibaca dari satu tempat.
 *  3. Pencatatan operasi massal (`batch_operation_log` — import/bulk delete).
 *
 * Catatan: kegagalan audit TIDAK boleh menggagalkan operasi utama pada jalur
 * ini (best-effort + console.error). Untuk perubahan data bisnis, konsistensi
 * dijamin trigger (satu transaksi dengan data).
 */

import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  computeChangedFields,
  maskAuditValue,
  sanitizeAuditPayload,
} from '@/lib/server/audit-mask';

// Re-export agar pemanggil cukup mengimpor dari satu modul.
export { computeChangedFields, maskAuditValue, sanitizeAuditPayload };

export type AuditModule =
  | 'keanggotaan'
  | 'pewarisan_nik'
  | 'dana_kematian'
  | 'pelayanan'
  | 'keuangan'
  | 'master_data'
  | 'user_management'
  | 'sistem';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'APPROVE'
  | 'REJECT'
  | 'VERIFY'
  | 'LOGIN'
  | 'LOGOUT'
  | 'OTHER';

export interface WriteAuditInput {
  module: AuditModule | string;
  tableName: string;
  entityId?: string | null;
  anggotaId?: string | null;
  action: AuditAction | string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRoleSlug?: string | null;
  reason?: string | null;
  source?: 'api' | 'job' | 'system' | 'migration';
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Tulis satu baris audit (best-effort). Tidak melempar error.
 * Mengembalikan true bila baris audit berhasil disimpan.
 */
export async function writeAudit(input: WriteAuditInput): Promise<boolean> {
  if (!supabaseAdmin) {
    console.warn('[AUDIT] Supabase admin client tidak tersedia — audit dilewati.');
    return false;
  }

  const oldValues = sanitizeAuditPayload(input.oldValues);
  const newValues = sanitizeAuditPayload(input.newValues);
  const changedFields =
    input.changedFields ?? computeChangedFields(oldValues, newValues);

  const { error } = await supabaseAdmin.from('audit_log').insert({
    module: input.module,
    table_name: input.tableName,
    entity_id: input.entityId ?? null,
    anggota_id: input.anggotaId ?? null,
    action: input.action,
    old_values: oldValues,
    new_values: newValues,
    changed_fields: changedFields,
    actor_user_id: input.actorUserId ?? null,
    actor_name: input.actorName ?? null,
    actor_role_slug: input.actorRoleSlug ?? null,
    reason: input.reason ?? null,
    source: input.source ?? (input.actorUserId ? 'api' : 'system'),
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) {
    console.error('[AUDIT] Gagal menulis audit_log:', error.message);
    return false;
  }

  return true;
}

/**
 * Lengkapi identitas aktor (nama & role) dari Prisma bila hanya id tersedia.
 * Dipakai oleh bridging SystemLog & aksi workflow.
 */
export async function resolveActor(actorUserId?: string | null): Promise<{
  id: string | null;
  name: string | null;
  roleSlug: string | null;
}> {
  if (!actorUserId) return { id: null, name: null, roleSlug: null };

  try {
    const user = await prisma.user.findUnique({
      where: { id: actorUserId },
      include: { role: true },
    });
    if (!user) return { id: actorUserId, name: null, roleSlug: null };
    return {
      id: user.id,
      name: user.name ?? user.email ?? null,
      roleSlug: user.role?.slug ?? null,
    };
  } catch (error) {
    console.error('[AUDIT] Gagal resolve aktor:', error);
    return { id: actorUserId, name: null, roleSlug: null };
  }
}

export interface BatchOperationLogInput {
  operationType: string;
  tableName: string;
  totalRecords: number;
  successCount?: number;
  failureCount?: number;
  errorSummary?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  performedBy?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Catat operasi massal (import Excel / bulk delete) ke `batch_operation_log`
 * yang sebelumnya tidak pernah dipakai (migration 025).
 */
export async function logBatchOperation(input: BatchOperationLogInput): Promise<void> {
  if (!supabaseAdmin) return;

  const baseRow = {
    operation_type: input.operationType,
    table_name: input.tableName,
    total_records: input.totalRecords,
    success_count: input.successCount ?? 0,
    failure_count: input.failureCount ?? 0,
    error_summary: input.errorSummary ?? null,
    file_name: input.fileName ?? null,
    file_size_bytes: input.fileSizeBytes ?? null,
    status: input.status ?? 'completed',
    performer_ip: input.ipAddress ?? null,
    performer_user_agent: input.userAgent ?? null,
    metadata: input.metadata ?? null,
    completed_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('batch_operation_log')
    .insert({ ...baseRow, performed_by: input.performedBy ?? null });

  if (!error) return;

  // Tabel lama masih memiliki FK performed_by → auth.users (migration 036
  // menghapusnya). Bila belum dimigrasi, simpan aktor di metadata saja.
  console.warn('[AUDIT] batch_operation_log insert gagal, mencoba fallback:', error.message);

  const { error: fallbackError } = await supabaseAdmin
    .from('batch_operation_log')
    .insert({
      ...baseRow,
      performed_by: null,
      metadata: {
        ...(input.metadata || {}),
        performed_by_user_id: input.performedBy ?? null,
      },
    });

  if (fallbackError) {
    console.error('[AUDIT] Gagal mencatat batch_operation_log:', fallbackError.message);
  }
}

