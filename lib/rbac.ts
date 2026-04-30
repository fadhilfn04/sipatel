/**
 * RBAC Configuration & Utilities
 * Role-Based Access Control untuk P2Tel System
 */

import { User, UserPermission, UserRole } from '@/app/models/user';

// Permission slugs yang digunakan di sistem
export const PERMISSIONS = {
  // Keanggotaan
  ACCESS_KEANGGOTAAN: 'access_keanggotaan',
  MANAGE_KEANGGOTAAN: 'manage_keanggotaan',
  VIEW_KEANGGOTAAN: 'view_keanggotaan',
  HISTORY_ANGGOTA_VIEW: 'history_anggota_view',
  HISTORY_ANGGOTA_MANAGE: 'history_anggota_manage',

  // Pelayanan
  ACCESS_DANA_KEMATIAN: 'access_dana_kematian',
  MANAGE_DANA_KEMATIAN: 'manage_dana_kematian',
  ACCESS_DANA_SOCIAL: 'access_dana_social',
  MANAGE_DANA_SOCIAL: 'manage_dana_social',

  // Keuangan
  ACCESS_KEUANGAN: 'access_keuangan',
  MANAGE_LAPORAN: 'manage_laporan_keuangan',
  VIEW_IURAN: 'view_iuran',
  MANAGE_IURAN: 'manage_iuran',

  // Surat Elektronik
  ACCESS_SURAT: 'access_surat',
  MANAGE_SURAT: 'manage_surat',

  // User Management
  ACCESS_USER_MANAGEMENT: 'access_user_management',
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_PERMISSIONS: 'manage_permissions',

  // Settings
  ACCESS_SETTINGS: 'access_settings',
  MANAGE_SYSTEM: 'manage_system',

  // Admin - Full access
  ALL_ACCESS: 'all_access',
} as const;

// Role slugs - MUST match exactly with UserRole.slug in database
export const ROLES = {
  ADMINISTRATOR: 'administrator',
  USER: 'user',
  KETUA_1: 'ketua-1',
} as const;

// Permission grouping untuk UI
export const PERMISSION_GROUPS = {
  KEANGGAOTAAN: {
    title: 'Keanggotaan',
    permissions: [
      PERMISSIONS.ACCESS_KEANGGOTAAN,
      PERMISSIONS.VIEW_KEANGGOTAAN,
      PERMISSIONS.MANAGE_KEANGGOTAAN,
      PERMISSIONS.HISTORY_ANGGOTA_VIEW,
      PERMISSIONS.HISTORY_ANGGOTA_MANAGE,
    ],
  },
  PELAYANAN: {
    title: 'Pelayanan',
    permissions: [
      PERMISSIONS.ACCESS_DANA_KEMATIAN,
      PERMISSIONS.MANAGE_DANA_KEMATIAN,
      PERMISSIONS.ACCESS_DANA_SOCIAL,
      PERMISSIONS.MANAGE_DANA_SOCIAL,
    ],
  },
  KEUANGAN: {
    title: 'Keuangan',
    permissions: [
      PERMISSIONS.ACCESS_KEUANGAN,
      PERMISSIONS.VIEW_IURAN,
      PERMISSIONS.MANAGE_IURAN,
      PERMISSIONS.MANAGE_LAPORAN,
    ],
  },
  SURAT: {
    title: 'Surat Elektronik',
    permissions: [PERMISSIONS.ACCESS_SURAT, PERMISSIONS.MANAGE_SURAT],
  },
  USER_MANAGEMENT: {
    title: 'Manajemen Pengguna',
    permissions: [
      PERMISSIONS.ACCESS_USER_MANAGEMENT,
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_ROLES,
      PERMISSIONS.MANAGE_PERMISSIONS,
    ],
  },
  SYSTEM: {
    title: 'Sistem',
    permissions: [
      PERMISSIONS.ACCESS_SETTINGS,
      PERMISSIONS.MANAGE_SYSTEM,
      PERMISSIONS.ALL_ACCESS,
    ],
  },
};

/**
 * Cek apakah user memiliki permission tertentu
 */
export function hasPermission(
  user: User | null,
  permissionSlug: string,
): boolean {
  if (!user) return false;

  // Administrator selalu memiliki semua akses
  if (user.role.slug === ROLES.ADMINISTRATOR) {
    return true;
  }

  // Cek apakah user memiliki permission yang diminta
  return (
    user.role.permissions?.some(
      (rolePermission) => rolePermission.permission?.slug === permissionSlug,
    ) ?? false
  );
}

/**
 * Cek apakah user memiliki salah satu dari beberapa permissions
 */
export function hasAnyPermission(
  user: User | null,
  permissionSlugs: string[],
): boolean {
  if (!user) return false;

  if (user.role.slug === ROLES.ADMINISTRATOR) {
    return true;
  }

  const userPermissions =
    user.role.permissions?.map((rp) => rp.permission?.slug).filter((slug): slug is string => !!slug) ?? [];

  return permissionSlugs.some((slug) => userPermissions.includes(slug));
}

/**
 * Cek apakah user memiliki semua permissions yang diminta
 */
export function hasAllPermissions(
  user: User | null,
  permissionSlugs: string[],
): boolean {
  if (!user) return false;

  if (user.role.slug === ROLES.ADMINISTRATOR) {
    return true;
  }

  const userPermissions =
    user.role.permissions?.map((rp) => rp.permission?.slug).filter((slug): slug is string => !!slug) ?? [];

  return permissionSlugs.every((slug) => userPermissions.includes(slug));
}

/**
 * Filter menu items berdasarkan permissions user
 */
export function filterMenuByPermissions<T extends { permissions?: string[] }>(
  user: User | null,
  items: T[],
): T[] {
  if (!user) return [];

  return items.filter((item) => {
    // Jika tidak ada permissions yang diminta, tampilkan untuk semua
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }

    // Cek apakah user memiliki salah satu permission yang diminta
    return hasAnyPermission(user, item.permissions);
  });
}

/**
 * Default permissions untuk setiap role
 */
export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.ADMINISTRATOR]: [
    // Administrator memiliki semua permissions
    ...Object.values(PERMISSIONS),
  ],

  [ROLES.USER]: [
    // User biasa hanya bisa view
    PERMISSIONS.ACCESS_KEANGGOTAAN,
    PERMISSIONS.VIEW_KEANGGOTAAN,
  ],

  [ROLES.KETUA_1]: [
    // Ketua 1 memiliki akses ke Keanggotaan dan Pelayanan
    PERMISSIONS.ACCESS_KEANGGOTAAN,
    PERMISSIONS.VIEW_KEANGGOTAAN,
    PERMISSIONS.MANAGE_KEANGGOTAAN,
    PERMISSIONS.ACCESS_DANA_KEMATIAN,
    PERMISSIONS.MANAGE_DANA_KEMATIAN,
    PERMISSIONS.ACCESS_DANA_SOCIAL,
    PERMISSIONS.MANAGE_DANA_SOCIAL,
    PERMISSIONS.ACCESS_KEUANGAN,
    PERMISSIONS.VIEW_IURAN,
    PERMISSIONS.MANAGE_IURAN,
  ],
};

/**
 * Untuk setup awal - buat permissions di database
 */
export const INITIAL_PERMISSIONS = [
  // Keanggotaan
  {
    slug: PERMISSIONS.ACCESS_KEANGGOTAAN,
    name: 'Akses Menu Keanggotaan',
    description: 'Akses ke menu Keanggotaan',
  },
  {
    slug: PERMISSIONS.VIEW_KEANGGOTAAN,
    name: 'View Data Keanggotaan',
    description: 'Lihat data anggota',
  },
  {
    slug: PERMISSIONS.MANAGE_KEANGGOTAAN,
    name: 'Manage Keanggotaan',
    description: 'Kelola data anggota (CRUD)',
  },

  // Pelayanan
  {
    slug: PERMISSIONS.ACCESS_DANA_KEMATIAN,
    name: 'Akses Dana Kematian',
    description: 'Akses ke menu Dana Kematian',
  },
  {
    slug: PERMISSIONS.MANAGE_DANA_KEMATIAN,
    name: 'Manage Dana Kematian',
    description: 'Kelola Dana Kematian',
  },
  {
    slug: PERMISSIONS.ACCESS_DANA_SOCIAL,
    name: 'Akses Dana Sosial',
    description: 'Akses ke menu Dana Sosial',
  },
  {
    slug: PERMISSIONS.MANAGE_DANA_SOCIAL,
    name: 'Manage Dana Sosial',
    description: 'Kelola Dana Sosial',
  },

  // Keuangan
  {
    slug: PERMISSIONS.ACCESS_KEUANGAN,
    name: 'Akses Keuangan',
    description: 'Akses ke menu Keuangan',
  },
  {
    slug: PERMISSIONS.VIEW_IURAN,
    name: 'View Iuran',
    description: 'Lihat data iuran',
  },
  {
    slug: PERMISSIONS.MANAGE_IURAN,
    name: 'Manage Iuran',
    description: 'Kelola data iuran (CRUD)',
  },
  {
    slug: PERMISSIONS.MANAGE_LAPORAN,
    name: 'Manage Laporan Keuangan',
    description: 'Kelola laporan keuangan',
  },

  // Surat
  {
    slug: PERMISSIONS.ACCESS_SURAT,
    name: 'Akses Surat',
    description: 'Akses ke menu Surat Elektronik',
  },
  {
    slug: PERMISSIONS.MANAGE_SURAT,
    name: 'Manage Surat',
    description: 'Kelola surat',
  },

  // User Management
  {
    slug: PERMISSIONS.ACCESS_USER_MANAGEMENT,
    name: 'Akses User Management',
    description: 'Akses ke menu User Management',
  },
  {
    slug: PERMISSIONS.MANAGE_USERS,
    name: 'Manage Users',
    description: 'Kelola users',
  },
  {
    slug: PERMISSIONS.MANAGE_ROLES,
    name: 'Manage Roles',
    description: 'Kelola roles',
  },
  {
    slug: PERMISSIONS.MANAGE_PERMISSIONS,
    name: 'Manage Permissions',
    description: 'Kelola permissions',
  },

  // System
  {
    slug: PERMISSIONS.ACCESS_SETTINGS,
    name: 'Akses Settings',
    description: 'Akses ke pengaturan',
  },
  {
    slug: PERMISSIONS.MANAGE_SYSTEM,
    name: 'Manage System',
    description: 'Kelola pengaturan sistem',
  },
  {
    slug: PERMISSIONS.ALL_ACCESS,
    name: 'All Access',
    description: 'Akses penuh ke semua fitur',
  },
];
