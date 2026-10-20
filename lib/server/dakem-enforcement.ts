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
import { supabaseAdmin } from '@/lib/supabase-storage';
import type { DakemActorContext } from './dakem-enforcement-rules';

/**
 * Slug permission kanonik (dot notation) yang dipakai UI (`use-user-permissions`)
 * dan aturan server. Seed lama memakai underscore (`dana_kematian_pc_*` /
 * `dana_kematian_pp_*`), sehingga keduanya diperiksa agar capability tidak
 * salah resolve (drift permission).
 */
export const DAKEM_PERMISSION_MANAGE_PC = 'dana_kematian.manage_pc';
export const DAKEM_PERMISSION_VERIFY_PP = 'dana_kematian.verify_pp';

/** Alias legacy (underscore) yang setara dengan capability Pusat. */
const PP_PERMISSION_SLUGS = [
  DAKEM_PERMISSION_VERIFY_PP,
  'dana_kematian_pp_view_all',
  'dana_kematian_pp_verify_documents',
  'dana_kematian_pp_approve_claim',
  'dana_kematian_admin_full_access',
];

/** Alias legacy (underscore) yang setara dengan capability Cabang. */
const PC_PERMISSION_SLUGS = [
  DAKEM_PERMISSION_MANAGE_PC,
  'dana_kematian_pc_view',
  'dana_kematian_pc_create',
  'dana_kematian_pc_edit',
  'dana_kematian_pc_submit_to_pp',
  'manage_dana_kematian',
  'access_dana_kematian',
];

const SUPERUSER_ROLE_SLUGS = ['admin', 'administrator', 'owner'];

function userHasAny(user: any, slugs: string[]): boolean {
  return slugs.some(slug => hasPermission(user, slug));
}


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
    const canVerifyPP = isSuperuser || userHasAny(user, PP_PERMISSION_SLUGS);
    const canManagePC = isSuperuser || userHasAny(user, PC_PERMISSION_SLUGS);

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

/** Cabang tempat user terdaftar (dari tabel anggota). Null bila tidak ada. */
export async function getActorCabang(userId: string): Promise<{
  nama_cabang: string | null;
  kode_cabang: string | null;
}> {
  try {
    if (!supabaseAdmin || !userId) return { nama_cabang: null, kode_cabang: null };
    const { data } = await supabaseAdmin
      .from('anggota')
      .select('nama_cabang, kode_cabang')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    return {
      nama_cabang: data?.nama_cabang ?? null,
      kode_cabang: data?.kode_cabang ?? null,
    };
  } catch {
    return { nama_cabang: null, kode_cabang: null };
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
