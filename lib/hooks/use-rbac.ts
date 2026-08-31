/**
 * Custom hooks for RBAC (Role-Based Access Control)
 */

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { hasPermission, hasAnyPermission, hasAllPermissions, filterMenuByPermissions } from '@/lib/rbac';
import { User } from '@/app/models/user';

/**
 * Hook to check if current user has a specific permission
 */
export function useHasPermission(permissionSlug: string) {
  const { data: session } = useSession();

  return useMemo(() => {
    const user = session?.user as User | null;
    return hasPermission(user, permissionSlug);
  }, [session, permissionSlug]);
}

/**
 * Hook to check if current user has any of the specified permissions
 */
export function useHasAnyPermission(permissionSlugs: string[]) {
  const { data: session } = useSession();

  return useMemo(() => {
    const user = session?.user as User | null;
    return hasAnyPermission(user, permissionSlugs);
  }, [session, permissionSlugs]);
}

/**
 * Hook to check if current user has all of the specified permissions
 */
export function useHasAllPermissions(permissionSlugs: string[]) {
  const { data: session } = useSession();

  return useMemo(() => {
    const user = session?.user as User | null;
    return hasAllPermissions(user, permissionSlugs);
  }, [session, permissionSlugs]);
}

/**
 * Hook to filter menu items based on user permissions
 */
export function useFilteredMenu<T extends { permissions?: string[] }>(
  items: T[]
) {
  const { data: session } = useSession();

  return useMemo(() => {
    const user = session?.user as User | null;
    return filterMenuByPermissions(user, items);
  }, [session, items]);
}

/**
 * Hook to get current user's permissions
 */
export function useUserPermissions() {
  const { data: session } = useSession();

  return useMemo(() => {
    const user = session?.user as User | null;
    if (!user) return [];

    // Administrator has all permissions
    if (user.role.slug === 'administrator') {
      return ['all_access'];
    }

    return user.role.permissions?.map((rp) => rp.permission?.slug).filter((slug): slug is string => !!slug) ?? [];
  }, [session]);
}

/**
 * Hook to get current user's role
 */
export function useUserRole() {
  const { data: session } = useSession();

  return useMemo(() => {
    const user = session?.user as User | null;
    return user?.role ?? null;
  }, [session]);
}
