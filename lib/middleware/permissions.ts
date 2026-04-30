/**
 * Permission Middleware for Dana Kematian
 * Checks user permissions before allowing access to actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import prisma from '@/lib/prisma';
import {
  hasPermission,
  canAccessPPVerification,
  canAccessPCManagement,
  canVerifyPP
} from '@/lib/permissions/dana-kematian';
import { DANA_KEMATIAN_PERMISSIONS } from '@/lib/permissions/dana-kematian';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

/**
 * Check if current user has specific permission
 */
export async function checkUserPermission(
  request: NextRequest,
  requiredPermission: string
): Promise<PermissionCheckResult> {
  try {
    // Get user session - adjust based on your auth system
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return {
        allowed: false,
        reason: 'Not authenticated'
      };
    }

    // Get user permissions from your user management system
    const userPermissions = await getUserPermissions(session.user.id);

    // Check if user has the required permission
    const hasAccess = hasPermission(userPermissions, requiredPermission);

    if (!hasAccess) {
      return {
        allowed: false,
        reason: `Missing permission: ${requiredPermission}`
      };
    }

    return { allowed: true };

  } catch (error) {
    console.error('Permission check error:', error);
    return {
      allowed: false,
      reason: 'Error checking permissions'
    };
  }
}

/**
 * Check if user can access PP verification page
 */
export async function canAccessPPVerificationPage(
  request: NextRequest
): Promise<PermissionCheckResult> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return {
        allowed: false,
        reason: 'Not authenticated'
      };
    }

    // Get user role
    const userRole = await getUserRole(session.user.id);

    // Check if user can access PP verification
    const canAccess = canAccessPPVerification(userRole);

    if (!canAccess) {
      return {
        allowed: false,
        reason: 'Hanya Ketua I, Ketua II, dan Admin yang dapat mengakses verifikasi PP'
      };
    }

    return { allowed: true };

  } catch (error) {
    console.error('Access check error:', error);
    return {
      allowed: false,
      reason: 'Error checking access'
    };
  }
}

/**
 * Check if user can verify a specific claim based on role and amount
 */
export async function canVerifyClaim(
  request: NextRequest,
  claimAmount: number
): Promise<PermissionCheckResult & { needsApproval?: boolean }> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return {
        allowed: false,
        reason: 'Not authenticated'
      };
    }

    // Get user role
    const userRole = await getUserRole(session.user.id);

    // Check verification permissions
    const verification = canVerifyPP(userRole, claimAmount);

    return verification;

  } catch (error) {
    console.error('Verification check error:', error);
    return {
      allowed: false,
      reason: 'Error checking verification permissions'
    };
  }
}

/**
 * Middleware helper to protect API routes
 */
export function requirePermission(requiredPermission: string) {
  return async (request: NextRequest) => {
    const check = await checkUserPermission(request, requiredPermission);

    if (!check.allowed) {
      return NextResponse.json(
        {
          error: 'Permission denied',
          reason: check.reason,
          required_permission: requiredPermission
        },
        { status: 403 }
      );
    }

    // Continue to next middleware or route handler
    return NextResponse.next();
  };
}

/**
 * Middleware to protect PP verification routes
 */
export function requirePPVerification() {
  return async (request: NextRequest) => {
    const check = await canAccessPPVerificationPage(request);

    if (!check.allowed) {
      return NextResponse.json(
        {
          error: 'Access denied',
          reason: check.reason
        },
        { status: 403 }
      );
    }

    return NextResponse.next();
  };
}

/**
 * Middleware to protect PC management routes
 */
export function requirePCManagement() {
  return async (request: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }

      // Get user role
      const userRole = await getUserRole(session.user.id);

      // Check if user can access PC management
      const canAccess = canAccessPCManagement(userRole);

      if (!canAccess) {
        return NextResponse.json(
          {
            error: 'Access denied',
            reason: 'Hanya staff PC, Kepala PC, dan Admin yang dapat mengakses fitur cabang'
          },
          { status: 403 }
        );
      }

      return NextResponse.next();

    } catch (error) {
      console.error('PC management check error:', error);
      return NextResponse.json(
        { error: 'Error checking access' },
        { status: 500 }
      );
    }
  };
}

// Helper functions to get user data from Prisma database

async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (!user?.role?.permissions) return [];

    return user.role.permissions.map((rp) => rp.permission.slug);
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

async function getUserRole(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true
      }
    });

    return user?.role?.slug || 'guest';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return 'guest';
  }
}