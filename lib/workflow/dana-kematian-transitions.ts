/**
 * Dana Kematian — Backend State Transition Validation
 *
 * This module mirrors the frontend state machine
 * (lib/workflow/dana-kematian-state-machine.ts) so that the backend
 * can independently reject invalid status transitions.
 *
 * The frontend state machine defines the canonical workflow.
 * This backend validator MUST stay in sync with it.
 *
 * If a transition is NOT listed here, it is rejected by the backend.
 */

export type DanaKematianStatus =
  | 'dilaporkan'
  | 'pending_dokumen'
  | 'verifikasi_cabang'
  | 'revisi_pusat'
  | 'proses_pusat'
  | 'verified'
  | 'penyaluran'
  | 'selesai'
  | 'ditolak';

/**
 * Allowed transitions: { from: [to1, to2, ...] }
 *
 * Derived from STATE_TRANSITIONS in dana-kematian-state-machine.ts.
 * Every valid forward/backward path is explicitly listed.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  dilaporkan: ['verifikasi_cabang', 'ditolak'],
  verifikasi_cabang: ['pending_dokumen', 'proses_pusat', 'ditolak'],
  pending_dokumen: ['proses_pusat', 'ditolak'],
  revisi_pusat: ['proses_pusat', 'ditolak'],
  proses_pusat: ['verified', 'pending_dokumen', 'ditolak'],
  verified: ['penyaluran', 'ditolak'],
  penyaluran: ['selesai', 'ditolak'],
  selesai: [], // Terminal state — no further transitions
  ditolak: ['dilaporkan'], // Allow resubmission (admin only, enforced separately)
};

export interface TransitionValidationResult {
  valid: boolean;
  message: string;
}

/**
 * Validate whether a status transition is allowed.
 *
 * Usage:
 *   const result = isValidStatusTransition('dilaporkan', 'selesai');
 *   // { valid: false, message: '...' }
 */
export function isValidStatusTransition(
  from: string,
  to: string,
): TransitionValidationResult {
  // Same status is always allowed (no-op update)
  if (from === to) {
    return { valid: true, message: 'Status unchanged' };
  }

  const allowed = ALLOWED_TRANSITIONS[from];

  if (!allowed) {
    return {
      valid: false,
      message: `Status '${from}' is not a recognized workflow state`,
    };
  }

  if (!allowed.includes(to)) {
    return {
      valid: false,
      message: `Transisi dari '${from}' ke '${to}' tidak diizinkan oleh workflow`,
    };
  }

  return { valid: true, message: 'Transition valid' };
}

/**
 * Get all valid next statuses from a given status.
 */
export function getValidNextStatuses(from: string): string[] {
  return ALLOWED_TRANSITIONS[from] || [];
}