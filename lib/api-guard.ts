/**
 * API Guard — proteksi terpusat untuk route API SIPATEL.
 *
 * Menyatukan pola yang sudah dipakai /api/audit-trail:
 *  - belum login            → 401 (notAuthenticatedResponse)
 *  - login tapi tanpa izin  → 403 (unauthorizedResponse)
 *
 * Pemakaian:
 * ```ts
 * const guard = await guardPermissions([PERMISSIONS.ACCESS_KEUANGAN]);
 * if (guard.error) return guard.error;
 * // guard.user tersedia (typed User)
 * ```
 */

import { NextResponse } from 'next/server';
import {
  getCurrentUser,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { hasAnyPermission } from '@/lib/rbac';
import type { User } from '@/app/models/user';

export type GuardResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse };

/** Wajib login + memiliki salah satu permission yang diberikan. */
export async function guardPermissions(
  permissionSlugs: string[],
  message?: string,
): Promise<GuardResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { user: null, error: notAuthenticatedResponse() };
  }

  if (permissionSlugs.length > 0 && !hasAnyPermission(user as unknown as User, permissionSlugs)) {
    return { user: null, error: unauthorizedResponse(message) };
  }

  return { user: user as unknown as User, error: null };
}

/** Wajib login saja (tanpa cek permission terperinci). */
export async function guardSession(): Promise<GuardResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { user: null, error: notAuthenticatedResponse() };
  }

  return { user: user as unknown as User, error: null };
}
