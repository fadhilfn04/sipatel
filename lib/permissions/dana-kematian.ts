/**
 * Permission System for Dana Kematian
 * Role-Based Access Control (RBAC) implementation
 */

// Permission slugs for Dana Kematian operations
export const DANA_KEMATIAN_PERMISSIONS = {
  // PC (Pengurus Cabang) permissions
  PC_CREATE: 'dana_kematian_pc_create',
  PC_EDIT: 'dana_kematian_pc_edit',
  PC_DELETE: 'dana_kematian_pc_delete',
  PC_VIEW: 'dana_kematian_pc_view',
  PC_SUBMIT_TO_PP: 'dana_kematian_pc_submit_to_pp',
  PC_VALIDATE_FAMILY: 'dana_kematian_pc_validate_family',
  PC_COMMUNICATE_HEIR: 'dana_kematian_pc_communicate_heir',
  PC_DELIVER_FUNDS: 'dana_kematian_pc_deliver_funds',
  PC_CREATE_REPORTS: 'dana_kematian_pc_create_reports',

  // PP (Pengurus Pusat) permissions
  PP_VIEW_ALL: 'dana_kematian_pp_view_all',
  PP_VERIFY_DOCUMENTS: 'dana_kematian_pp_verify_documents',
  PP_VERIFY_ELIGIBILITY: 'dana_kematian_pp_verify_eligibility',
  PP_CALCULATE_BENEFIT: 'dana_kematian_pp_calculate_benefit',
  PP_APPROVE_CLAIM: 'dana_kematian_pp_approve_claim',
  PP_REJECT_CLAIM: 'dana_kematian_pp_reject_claim',
  PP_RETURN_CLAIM: 'dana_kematian_pp_return_claim',
  PP_PROCESS_FUNDS: 'dana_kematian_pp_process_funds',

  // Admin permissions
  ADMIN_FULL_ACCESS: 'dana_kematian_admin_full_access'
} as const;

// Role definitions for Dana Kematian
export const DANA_KEMATIAN_ROLES = {
  KETUA_I: {
    slug: 'ketua-1', // Updated to match existing database slug
    name: 'Ketua I',
    description: 'Pimpinan Pusat - Level 1, full access ke verifikasi PP',
    level: 1,
    permissions: [
      DANA_KEMATIAN_PERMISSIONS.PP_VIEW_ALL,
      DANA_KEMATIAN_PERMISSIONS.PP_VERIFY_DOCUMENTS,
      DANA_KEMATIAN_PERMISSIONS.PP_VERIFY_ELIGIBILITY,
      DANA_KEMATIAN_PERMISSIONS.PP_CALCULATE_BENEFIT,
      DANA_KEMATIAN_PERMISSIONS.PP_APPROVE_CLAIM,
      DANA_KEMATIAN_PERMISSIONS.PP_REJECT_CLAIM,
      DANA_KEMATIAN_PERMISSIONS.PP_RETURN_CLAIM,
      DANA_KEMATIAN_PERMISSIONS.PP_PROCESS_FUNDS
    ]
  },
  KETUA_II: {
    slug: 'ketua-2', // Updated to match existing database slug
    name: 'Ketua II',
    description: 'Pimpinan Pusat - Level 2, dapat verifikasi tapi butuh approval Ketua I untuk amounts > Rp 100 juta',
    level: 2,
    permissions: [
      DANA_KEMATIAN_PERMISSIONS.PP_VIEW_ALL,
      DANA_KEMATIAN_PERMISSIONS.PP_VERIFY_DOCUMENTS,
      DANA_KEMATIAN_PERMISSIONS.PP_VERIFY_ELIGIBILITY,
      DANA_KEMATIAN_PERMISSIONS.PP_CALCULATE_BENEFIT,
      DANA_KEMATIAN_PERMISSIONS.PP_APPROVE_CLAIM, // With limitation
      DANA_KEMATIAN_PERMISSIONS.PP_RETURN_CLAIM
    ]
  },
  PC_STAFF: {
    slug: 'pc_staff',
    name: 'Staff PC',
    description: 'Staff Pengurus Cabang, dapat mengelola pengajuan di tingkat cabang',
    level: 3,
    permissions: [
      DANA_KEMATIAN_PERMISSIONS.PC_VIEW,
      DANA_KEMATIAN_PERMISSIONS.PC_CREATE,
      DANA_KEMATIAN_PERMISSIONS.PC_EDIT,
      DANA_KEMATIAN_PERMISSIONS.PC_VALIDATE_FAMILY,
      DANA_KEMATIAN_PERMISSIONS.PC_COMMUNICATE_HEIR,
      DANA_KEMATIAN_PERMISSIONS.PC_SUBMIT_TO_PP,
      DANA_KEMATIAN_PERMISSIONS.PC_DELIVER_FUNDS,
      DANA_KEMATIAN_PERMISSIONS.PC_CREATE_REPORTS
    ]
  },
  PC_KEPALA: {
    slug: 'pc_kepala',
    name: 'Kepala PC',
    description: 'Kepala Pengurus Cabang, sama dengan staff PC plus bisa delete',
    level: 3,
    permissions: [
      ...DANA_KEMATIAN_ROLES.PC_STAFF.permissions,
      DANA_KEMATIAN_PERMISSIONS.PC_DELETE
    ]
  },
  ADMIN: {
    slug: 'admin',
    name: 'Administrator',
    description: 'System Administrator dengan full access',
    level: 0,
    permissions: [
      DANA_KEMATIAN_PERMISSIONS.ADMIN_FULL_ACCESS
    ]
  }
} as const;

// Permission checker functions
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  // Admin has all permissions
  if (userPermissions.includes(DANA_KEMATIAN_PERMISSIONS.ADMIN_FULL_ACCESS)) {
    return true;
  }

  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  // Admin has all permissions
  if (userPermissions.includes(DANA_KEMATIAN_PERMISSIONS.ADMIN_FULL_ACCESS)) {
    return true;
  }

  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  // Admin has all permissions
  if (userPermissions.includes(DANA_KEMATIAN_PERMISSIONS.ADMIN_FULL_ACCESS)) {
    return true;
  }

  return requiredPermissions.every(permission => userPermissions.includes(permission));
}

// Role-based access control
export function canVerifyPP(userRole: string, claimAmount?: number): {
  canVerify: boolean;
  needsApproval: boolean;
  reason?: string;
} {
  switch (userRole) {
    case 'ketua-1': // Updated to match database slug
      return {
        canVerify: true,
        needsApproval: false
      };

    case 'ketua-2': // Updated to match database slug
      return {
        canVerify: true,
        needsApproval: claimAmount ? claimAmount > 100000000 : false, // > 100 juta butuh approval
        reason: claimAmount && claimAmount > 100000000
          ? 'Memerlukan approval Ketua I untuk amount > Rp 100 juta'
          : undefined
      };

    case 'admin':
    case 'administrator':
      return {
        canVerify: true,
        needsApproval: false
      };

    default:
      return {
        canVerify: false,
        needsApproval: false,
        reason: 'Hanya Ketua I, Ketua II, dan Admin yang dapat melakukan verifikasi PP'
      };
  }
}

export function canAccessPPVerification(userRole: string): boolean {
  const allowedRoles = ['ketua-1', 'ketua-2', 'admin', 'administrator'];
  return allowedRoles.includes(userRole);
}

export function canAccessPCManagement(userRole: string): boolean {
  const allowedRoles = ['pc_staff', 'pc_kepala', 'admin', 'administrator'];
  return allowedRoles.includes(userRole);
}

// Get role level (lower = higher priority)
export function getRoleLevel(userRole: string): number {
  const role = Object.values(DANA_KEMATIAN_ROLES).find(r => r.slug === userRole);
  return role?.level ?? 999;
}

// Check if user can override decision
export function canOverrideVerification(userRole: string, originalVerifierRole: string): boolean {
  const userLevel = getRoleLevel(userRole);
  const originalLevel = getRoleLevel(originalVerifierRole);

  return userLevel < originalLevel; // Lower level = higher priority
}

// Workflow permissions based on claim status
export function getWorkflowPermissions(claimStatus: string, userRole: string) {
  const permissions: string[] = [];

  // Get base permissions from role
  const roleConfig = Object.values(DANA_KEMATIAN_ROLES).find(r => r.slug === userRole);
  if (roleConfig) {
    permissions.push(...roleConfig.permissions);
  }

  // Add permissions based on claim status
  switch (claimStatus) {
    case 'dilaporkan':
      // PC can edit and submit
      if (canAccessPCManagement(userRole)) {
        permissions.push(
          DANA_KEMATIAN_PERMISSIONS.PC_EDIT,
          DANA_KEMATIAN_PERMISSIONS.PC_VALIDATE_FAMILY,
          DANA_KEMATIAN_PERMISSIONS.PC_COMMUNICATE_HEIR
        );
      }
      break;

    case 'verifikasi_cabang':
      // PC can continue validation
      if (canAccessPCManagement(userRole)) {
        permissions.push(
          DANA_KEMATIAN_PERMISSIONS.PC_VALIDATE_FAMILY,
          DANA_KEMATIAN_PERMISSIONS.PC_COMMUNICATE_HEIR
        );
      }
      break;

    case 'pending_dokumen':
      // PC can upload documents
      if (canAccessPCManagement(userRole)) {
        permissions.push(
          DANA_KEMATIAN_PERMISSIONS.PC_EDIT
        );
      }
      break;

    case 'proses_pusat':
      // Only PP can verify
      if (canAccessPPVerification(userRole)) {
        permissions.push(
          DANA_KEMATIAN_PERMISSIONS.PP_VERIFY_DOCUMENTS,
          DANA_KEMATIAN_PERMISSIONS.PP_VERIFY_ELIGIBILITY,
          DANA_KEMATIAN_PERMISSIONS.PP_CALCULATE_BENEFIT
        );
      }
      break;

    case 'verified':
      // PP can process funds
      if (canAccessPPVerification(userRole)) {
        permissions.push(
          DANA_KEMATIAN_PERMISSIONS.PP_PROCESS_FUNDS
        );
      }
      break;

    case 'penyaluran':
      // PC can deliver funds and create reports
      if (canAccessPCManagement(userRole)) {
        permissions.push(
          DANA_KEMATIAN_PERMISSIONS.PC_DELIVER_FUNDS,
          DANA_KEMATIAN_PERMISSIONS.PC_CREATE_REPORTS
        );
      }
      break;

    case 'selesai':
      // No actions allowed
      break;

    case 'ditolak':
      // Limited actions based on rejection reason
      break;
  }

  return permissions;
}

// Export permission types
export type DanaKematianPermission = typeof DANA_KEMATIAN_PERMISSIONS[keyof typeof DANA_KEMATIAN_PERMISSIONS];
export type DanaKematianRole = keyof typeof DANA_KEMATIAN_ROLES;