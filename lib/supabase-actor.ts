/**
 * Supabase client dengan konteks AKTOR untuk audit trail terpusat.
 *
 * Setiap penulisan data melalui client ini otomatis membawa header:
 *  - x-app-user-id   (User.id Prisma — dibaca trigger audit_log_row())
 *  - x-app-user-name (snapshot nama aktor)
 *  - x-app-user-role (snapshot role slug)
 *  - x-app-ip        (IP client, opsional)
 * sehingga baris `audit_log` yang dibuat trigger mengetahui SIAPA yang
 * mengubah data — menutup gap `anggota_history.changed_by` yang selalu NULL.
 *
 * Pemakaian (pola adopsi bertahap di route API):
 * ```ts
 * import { getActorClient } from '@/lib/supabase-actor';
 *
 * export async function POST(request: NextRequest) {
 *   const user = await requirePermission(...);
 *   const supabase = await getActorClient(); // header aktor otomatis terpasang
 *   ...
 * }
 * ```
 *
 * Konteks header diekspos PostgREST sebagai GUC `request.headers` dan dibaca
 * oleh fungsi `audit_request_context()` (migration 036).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/rbac-server';
import { getClientIP } from '@/lib/api';
import type { NextRequest } from 'next/server';

export interface AuditActor {
  id: string;
  name?: string | null;
  roleSlug?: string | null;
}

/** Header aktor yang dibaca trigger audit_log_row(). */
export function buildActorHeaders(
  actor?: AuditActor | null,
  options?: { request?: NextRequest; reason?: string | null },
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (actor?.id) {
    headers['x-app-user-id'] = actor.id;
    if (actor.name) headers['x-app-user-name'] = String(actor.name).slice(0, 255);
    if (actor.roleSlug) headers['x-app-user-role'] = String(actor.roleSlug).slice(0, 50);
  }
  if (options?.reason) {
    headers['x-app-reason'] = String(options.reason).slice(0, 500);
  }
  if (options?.request) {
    try {
      const ip = getClientIP(options.request);
      if (ip) headers['x-app-ip'] = ip.slice(0, 45);
    } catch {
      // IP opsional — abaikan bila gagal dibaca.
    }
  }

  return headers;
}

/**
 * Client Supabase (service role) dengan header aktor dari session saat ini.
 *
 * - Aktor diambil dari `getCurrentUser()` (session server) — BUKAN request body.
 * - Bila service role tidak dikonfigurasi, fallback ke client anon existing
 *   (tanpa header aktor) agar route tetap berfungsi seperti sebelumnya.
 */
export async function getActorClient(
  options?: { request?: NextRequest; reason?: string | null },
): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return supabase;
  }

  let actor: AuditActor | null = null;
  try {
    const user = await getCurrentUser();
    if (user?.id) {
      actor = {
        id: user.id,
        name: user.name ?? user.email ?? null,
        roleSlug: user.role?.slug ?? null,
      };
    }
  } catch {
    actor = null;
  }

  const headers = buildActorHeaders(actor, options);

  return createClient(supabaseUrl, serviceRoleKey, {
    global: { headers },
  });
}
