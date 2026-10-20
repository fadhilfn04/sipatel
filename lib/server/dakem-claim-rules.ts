/**
 * Dana Kematian — Aturan penugasan (claim) pengajuan antar-cabang.
 *
 * Aturan murni tanpa dependency server — dipakai oleh API route
 * (app/api/dana-kematian/[id]/claim) dan dapat diuji unit.
 *
 * Model kepemilikan:
 *  - `claim_status='diklaim'`  → pemilik = `cabang_pemilik_kode` (formal).
 *  - `claim_status='tersedia'` → baris lama (legacy) memakai `kode_cabang`
 *    (cabang pelapor) sebagai pemilik efektif; baris baru yang dibuat sejak
 *    migration 027 selalu diklaim otomatis oleh pembuatnya.
 *
 * Pusat/admin dapat mengalihkan kepemilikan (reassign) — tercatat di audit.
 */

export interface DakemClaimAssignment {
  claim_status?: string | null;
  cabang_pemilik_kode?: string | null;
  kode_cabang?: string | null;
  cabang_asal_melapor?: string | null;
  diklaim_oleh?: string | null;
  status_proses?: string | null;
}

export interface DakemClaimActor {
  isPusat: boolean;
  userId: string | null;
  kodeCabang: string | null;
  /** Nama cabang aktor — fallback untuk baris lama yang belum punya kode_cabang. */
  namaCabang?: string | null;
}

/** Status ketika pengajuan masih boleh diklaim cabang (belum submit ke pusat). */
export const CLAIMABLE_STATUSES = ['draft', 'dilaporkan', 'verifikasi_cabang'] as const;

/** Pemilik efektif pengajuan (kode cabang). */
export function resolveEffectiveOwnerKode(claim: DakemClaimAssignment): string | null {
  if (claim.claim_status === 'diklaim') {
    return claim.cabang_pemilik_kode ?? claim.kode_cabang ?? null;
  }
  // Legacy: cabang pelapor adalah pemilik efektif sampai diklaim/dialihkan.
  return claim.kode_cabang ?? null;
}

function sameBranch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Apakah pengajuan milik cabang aktor? Mempertimbangkan kode maupun nama
 * cabang agar baris lama (kode_cabang kosong / hanya nama) tetap dapat
 * diakses cabang yang berhak.
 */
export function isOwnedByActor(claim: DakemClaimAssignment, actor: DakemClaimActor): boolean {
  if (actor.isPusat) return true;
  const owner = resolveEffectiveOwnerKode(claim);
  return (
    sameBranch(owner, actor.kodeCabang) ||
    sameBranch(claim.kode_cabang, actor.kodeCabang) ||
    sameBranch(claim.cabang_asal_melapor, actor.namaCabang) ||
    sameBranch(owner, actor.namaCabang) ||
    sameBranch(claim.cabang_asal_melapor, actor.kodeCabang)
  );
}

/** Apakah aktor boleh mengedit pengajuan ini (data & dokumen)? */
export function canEditClaim(
  claim: DakemClaimAssignment,
  actor: DakemClaimActor,
): { allowed: boolean; reason?: string } {
  if (actor.isPusat) return { allowed: true };

  if (!actor.kodeCabang && !actor.namaCabang) {
    return { allowed: false, reason: 'User cabang tidak terhubung ke data cabang manapun.' };
  }

  const owner = resolveEffectiveOwnerKode(claim);
  if (!owner && !claim.cabang_asal_melapor) {
    // Tidak ada informasi cabang sama sekali — hanya bisa diakses pusat.
    return { allowed: false, reason: 'Pengajuan belum memiliki cabang pemilik.' };
  }

  if (!isOwnedByActor(claim, actor)) {
    return {
      allowed: false,
      reason: 'Pengajuan dimiliki cabang lain dan tidak dapat diubah oleh cabang Anda.',
    };
  }
  return { allowed: true };
}

/** Apakah pengajuan dapat diklaim oleh aktor (status tersedia)? */
export function canClaimClaim(
  claim: DakemClaimAssignment,
  actor: DakemClaimActor,
): { allowed: boolean; reason?: string } {
  if (actor.isPusat) {
    return { allowed: false, reason: 'Pusat mengalihkan kepemilikan lewat reassign, bukan claim.' };
  }

  if (!actor.kodeCabang && !actor.namaCabang) {
    return { allowed: false, reason: 'User cabang tidak terhubung ke data cabang manapun.' };
  }

  if (claim.claim_status === 'diklaim' && !isOwnedByActor(claim, actor)) {
    return { allowed: false, reason: 'Pengajuan sudah diklaim cabang lain.' };
  }

  if (claim.claim_status === 'diklaim' && isOwnedByActor(claim, actor)) {
    return { allowed: false, reason: 'Pengajuan sudah menjadi milik cabang Anda.' };
  }

  const status = String(claim.status_proses || '');
  if (!(CLAIMABLE_STATUSES as readonly string[]).includes(status)) {
    return {
      allowed: false,
      reason: `Pengajuan berstatus '${status}' tidak dapat diklaim — hanya pengajuan tahap awal yang tersedia.`,
    };
  }

  return { allowed: true };
}

/** Apakah aktor boleh melepas (release) pengajuan kembali ke tersedia? */
export function canReleaseClaim(
  claim: DakemClaimAssignment,
  actor: DakemClaimActor,
): { allowed: boolean; reason?: string } {
  if (claim.claim_status !== 'diklaim') {
    return { allowed: false, reason: 'Pengajuan tidak sedang diklaim.' };
  }
  if (actor.isPusat) return { allowed: true };

  if (!isOwnedByActor(claim, actor)) {
    return { allowed: false, reason: 'Hanya cabang pemilik atau Pusat yang dapat melepas pengajuan.' };
  }
  return { allowed: true };
}

/** Badge penugasan untuk UI (disesuaikan status workflow eksisting). */
export type DakemClaimBadge =
  | 'tersedia'
  | 'milik_cabang_sendiri'
  | 'diklaim_cabang_lain';

export function getClaimBadge(
  claim: DakemClaimAssignment,
  actor: DakemClaimActor,
): DakemClaimBadge {
  if (actor.isPusat) {
    return claim.claim_status === 'diklaim' ? 'diklaim_cabang_lain' : 'tersedia';
  }
  if (claim.claim_status !== 'diklaim') return 'tersedia';
  return isOwnedByActor(claim, actor) ? 'milik_cabang_sendiri' : 'diklaim_cabang_lain';
}

export const DAKEM_CLAIM_BADGE_LABELS: Record<DakemClaimBadge, string> = {
  tersedia: 'Tersedia',
  milik_cabang_sendiri: 'Milik Cabang Anda',
  diklaim_cabang_lain: 'Diklaim Cabang Lain',
};
