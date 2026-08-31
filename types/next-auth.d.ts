import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      roleId?: string | null;
      roleName?: string | null;
      status: string;
      role?: {
        id: string;
        name: string;
        slug: string;
        permissions?: Array<{
          permissionId: string;
          roleId: string;
          permission: {
            id: string;
            slug: string;
            name: string;
          };
        }>;
      };
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    roleId?: string | null;
    status: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    roleId?: string | null;
    roleName?: string | null;
    status: string;
    role?: {
      id: string;
      name: string;
      slug: string;
      permissions?: Array<{
        permissionId: string;
        roleId: string;
        permission: {
          id: string;
          slug: string;
          name: string;
        };
      }>;
    };
  }
}
