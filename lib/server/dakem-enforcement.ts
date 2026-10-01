/**
 * Dana Kematian — Server-side Enforcement (session-aware)
 *
 * Resolve konteks aktor dari session RBAC lalu delegasikan validasi ke
 * aturan murni di ./dakem-enforcement-rules.ts (yang dapat diuji unit).
 *
 * Peran ditentukan dari permission RBAC (sama seperti UI):
 *   - dana_kematian.manage_pc  → kapabilitas Cabang (PC / USER CABANG)
 *   - dana_kematian.verify_pp  → kapabilitas Pusat (PP) & admin superuser
 *
 * Lihat dakem-enforcement-rules.ts untuk detail aturan read-only pasca
 * submit ke Pusat.
 */

import { getCurrentUser } from '@/lib/rbac-server';
import { hasPermission } from '@/lib/rbac';
import type { DakemActorContext } from './dakem-enforcement-rules';

export const DAKEM_PERMISSION_MANAGE_PC = 'dana_kematian.manage_pc';
export const DAKEM_PERMISSION_VERIFY_PP = 'dana_kematian.verify_pp';

const SUPERUSER_ROLE_SLUGS = ['admin', 'administrator', 'owner'];

/**
 * Resolve konteks aktor dari session. User tanpa permission Pusat diperlakukan
 * sebagai USER CABANG (paling restriktif) sehingga kondisi read-only pasca
 * submit tidak dapat di-bypass lewat API langsung.
 */
export async function getDakemActorContext(): Promise<DakemActorContext> {
  try {
    const user = await getCurrentUser();
    const roleSlug = (user?.role?.slug as string) || '';
    const isSuperuser = SUPERUSER_ROLE_SLUGS.includes(roleSlug);
    const canVerifyPP =
      isSuperuser || (!!user && hasPermission(user as any, DAKEM_PERMISSION_VERIFY_PP));
    const canManagePC =
      isSuperuser || (!!user && hasPermission(user as any, DAKEM_PERMISSION_MANAGE_PC));

    return {
      userId: user?.id ?? null,
      roleSlug,
      isSuperuser,
      canManagePC,
      canVerifyPP,
      isCabangOnly: !canVerifyPP,
    };
  } catch {
    // Gagal resolve (mis. session tidak lengkap) → perlakukan paling restriktif.
    return {
      userId: null,
      roleSlug: '',
      isSuperuser: false,
      canManagePC: false,
      canVerifyPP: false,
      isCabangOnly: true,
    };
  }
}

export {
  CABANG_EDITABLE_STATUSES,
  PC_LATE_STAGE_FIELDS,
  PUSAT_OWNED_FIELDS,
  PUSAT_ONLY_STATUS_TARGETS,
  validateCabangPatchPermissions,
} from './dakem-enforcement-rules';
export type { CabangPatchValidation } from './dakem-enforcement-rules';
