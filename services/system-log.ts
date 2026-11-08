import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  resolveActor,
  writeAudit,
  type AuditAction,
} from '@/lib/server/audit-service';

export interface SystemLogProps {
  event: string;
  userId: string;
  entityId?: string;
  entityType?: string;
  description?: string;
  ipAddress?: string;
  meta?: string;
  /** Snapshot nilai SEBELUM perubahan (untuk audit old/new). */
  oldValues?: Record<string, unknown> | null;
  /** Snapshot nilai SESUDAH perubahan. */
  newValues?: Record<string, unknown> | null;
}

/**
 * Pemetaan event SystemLog (free-text) ke aksi audit terstandardisasi.
 * Lihat migration 036 (audit_log.action).
 */
const EVENT_ACTION_MAP: Record<string, AuditAction> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  trash: 'DELETE',
  restore: 'RESTORE',
  approve: 'APPROVE',
  reject: 'REJECT',
  verify: 'VERIFY',
  login: 'LOGIN',
  logout: 'LOGOUT',
  'change-password': 'UPDATE',
};

/** Parse meta JSON string menjadi object (toleran terhadap input tidak valid). */
function parseMeta(meta?: string): Record<string, unknown> | null {
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return { raw: meta };
  }
}

/**
 * Bridge SystemLog (log lama, event-level) ke audit_log terpusat sehingga
 * riwayat user-management dapat dibaca dari satu halaman audit.
 * Best-effort: kegagalan tidak mempengaruhi operasi utama.
 */
async function bridgeToAudit(props: SystemLogProps): Promise<void> {
  try {
    const actor = await resolveActor(props.userId);
    await writeAudit({
      module: 'user_management',
      tableName: props.entityType || 'User',
      entityId: props.entityId ?? null,
      action: EVENT_ACTION_MAP[props.event] ?? 'OTHER',
      oldValues: props.oldValues ?? null,
      newValues: props.newValues ?? parseMeta(props.meta),
      actorUserId: props.userId,
      actorName: actor.name,
      actorRoleSlug: actor.roleSlug,
      reason: props.description ?? null,
      source: 'api',
      ipAddress: props.ipAddress ?? null,
    });
  } catch (error) {
    console.error('[LOG] Bridge audit_log gagal:', error);
  }
}

export async function systemLog(
  {
    event,
    userId,
    entityId,
    entityType,
    description,
    ipAddress,
    meta,
    oldValues,
    newValues,
  }: SystemLogProps,
  tx?: Prisma.TransactionClient, // Optional transaction
) {
  try {
    // Use transaction if available, otherwise use Prisma client
    const connection = tx ?? prisma;

    await connection.systemLog.create({
      data: {
        event,
        userId,
        entityId,
        entityType,
        description,
        ipAddress,
        meta,
      },
    });

    // Bridge ke audit_log terpusat (non-blocking).
    void bridgeToAudit({
      event,
      userId,
      entityId,
      entityType,
      description,
      ipAddress,
      meta,
      oldValues,
      newValues,
    });
  } catch (error) {
    console.error('[LOG] Failed to log activity:', error);
  }
}

