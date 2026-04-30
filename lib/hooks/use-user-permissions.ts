/**
 * Hook to get current user permissions and role
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export interface UserPermissions {
  role: string;
  roleName: string;
  permissions: string[];
  canVerifyPP: boolean;
  canManagePC: boolean;
  isLoading: boolean;
}

export function useUserPermissions() {
  const [permissions, setPermissions] = useState<UserPermissions>({
    role: '',
    roleName: '',
    permissions: [],
    canVerifyPP: false,
    canManagePC: false,
    isLoading: true
  });

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return; // Wait for session to load

    if (!session?.user) {
      setPermissions(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Extract permissions from session
    const userRole = session.user.role;
    if (userRole) {
      const roleSlug = userRole.slug || 'guest';
      const userPermissions = userRole.permissions?.map((p: any) => p.permission?.slug || p.slug) || [];

      // Check specific Dana Kematian permissions
      const canVerifyPP = ['ketua-1', 'ketua-2', 'admin', 'administrator'].includes(roleSlug);
      const canManagePC = ['pc_staff', 'pc_kepala', 'admin', 'administrator'].includes(roleSlug);

      console.log('[useUserPermissions] Session loaded:', {
        roleSlug,
        roleName: userRole.name,
        canVerifyPP,
        canManagePC,
        permissionsCount: userPermissions.length
      });

      setPermissions({
        role: roleSlug,
        roleName: userRole.name || 'Guest',
        permissions: userPermissions,
        canVerifyPP,
        canManagePC,
        isLoading: false
      });
    } else {
      console.log('[useUserPermissions] No role found in session');
      setPermissions(prev => ({ ...prev, isLoading: false }));
    }
  }, [session, status]);

  return permissions;
}

/**
 * Hook to check if user has specific permission
 */
export function useHasPermission(requiredPermission: string) {
  const permissions = useUserPermissions();

  return {
    hasPermission: permissions.permissions.includes(requiredPermission) ||
                    permissions.permissions.includes('dana_kematian_admin_full_access'),
    isLoading: permissions.isLoading
  };
}

/**
 * Hook to check if user can access PP verification
 */
export function useCanAccessPPVerification() {
  const permissions = useUserPermissions();

  return {
    canAccess: permissions.canVerifyPP,
    isLoading: permissions.isLoading,
    role: permissions.role,
    roleName: permissions.roleName
  };
}

/**
 * Hook to check if user can manage PC operations
 */
export function useCanManagePC() {
  const permissions = useUserPermissions();

  return {
    canManage: permissions.canManagePC,
    isLoading: permissions.isLoading,
    role: permissions.role,
    roleName: permissions.roleName
  };
}