import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcrypt';
import { NextAuthOptions, Session, User } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import prisma from '@/lib/prisma';
import { resolveActor, writeAudit } from '@/lib/server/audit-service';

const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'boolean' },
      },
      async authorize(credentials) {
        if (!credentials || !credentials.email || !credentials.password) {
          throw new Error(
            JSON.stringify({
              code: 400,
              message: 'Please enter both email and password.',
            }),
          );
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          // Audit: percobaan login gagal (email tidak terdaftar).
          void writeAudit({
            module: 'user_management',
            tableName: 'User',
            action: 'LOGIN_FAILED',
            newValues: { email: credentials.email },
            reason: 'Email tidak terdaftar',
            source: 'api',
          });
          throw new Error(
            JSON.stringify({
              code: 404,
              message: 'User not found. Please register first.',
            }),
          );
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password || '',
        );

        if (!isPasswordValid) {
          // Audit: percobaan login gagal (password salah).
          void writeAudit({
            module: 'user_management',
            tableName: 'User',
            entityId: user.id,
            actorUserId: user.id,
            action: 'LOGIN_FAILED',
            newValues: { email: credentials.email },
            reason: 'Password salah',
            source: 'api',
          });
          throw new Error(
            JSON.stringify({
              code: 401,
              message: 'Invalid credentials. Incorrect password.',
            }),
          );
        }

        if (user.status !== 'ACTIVE') {
          // Audit: percobaan login gagal (akun belum aktif).
          void writeAudit({
            module: 'user_management',
            tableName: 'User',
            entityId: user.id,
            actorUserId: user.id,
            action: 'LOGIN_FAILED',
            newValues: { email: credentials.email },
            reason: 'Akun belum aktif',
            source: 'api',
          });
          throw new Error(
            JSON.stringify({
              code: 403,
              message: 'Account not activated. Please verify your email.',
            }),
          );
        }

        // Update `lastSignInAt` field
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSignInAt: new Date() },
        });

        return {
          id: user.id,
          status: user.status,
          email: user.email,
          name: user.name || 'Anonymous',
          roleId: user.roleId,
          avatar: user.avatar,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      async profile(profile) {
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (existingUser) {
          // Update `lastSignInAt` field for existing users
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: profile.name,
              avatar: profile.picture || null,
              lastSignInAt: new Date(),
            },
          });

          return {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name || 'Anonymous',
            status: existingUser.status,
            roleId: existingUser.roleId,
            roleName: existingUser.role.name,
            avatar: existingUser.avatar,
          };
        }

        const defaultRole = await prisma.userRole.findFirst({
          where: { isDefault: true },
        });

        if (!defaultRole) {
          throw new Error(
            'Default role not found. Unable to create a new user.',
          );
        }

        // Create a new user and account
        const newUser = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            password: '', // No password for OAuth users
            avatar: profile.picture || null,
            emailVerifiedAt: new Date(),
            roleId: defaultRole.id,
            status: 'ACTIVE',
          },
        });

        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name || 'Anonymous',
          status: newUser.status,
          avatar: newUser.avatar,
          roleId: newUser.roleId,
          roleName: defaultRole.name,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  /**
   * Audit trail — catat aktivitas autentikasi ke `audit_log`
   * (migration 036). Best-effort: kegagalan audit tidak menggagalkan login.
   */
  events: {
    async signIn({ user, account }) {
      try {
        const userId = user?.id ? String(user.id) : null;
        if (!userId) return;

        const actor = await resolveActor(userId);
        await writeAudit({
          module: 'user_management',
          tableName: 'User',
          entityId: userId,
          action: 'LOGIN',
          actorUserId: userId,
          actorName: actor.name ?? user.name ?? user.email ?? null,
          actorRoleSlug: actor.roleSlug,
          reason: account?.provider ? `Login via ${account.provider}` : 'Login',
          source: 'api',
        });
      } catch (error) {
        console.error('[AUDIT] Gagal mencatat LOGIN:', error);
      }
    },
    async signOut(message) {
      try {
        // Strategy JWT → pesan berisi token (bukan session).
        const token = (message as { token?: JWT }).token;
        const userId = (token?.id as string | undefined) ?? token?.sub ?? null;
        if (!userId) return;

        const actor = await resolveActor(userId);
        await writeAudit({
          module: 'user_management',
          tableName: 'User',
          entityId: userId,
          action: 'LOGOUT',
          actorUserId: userId,
          actorName: actor.name ?? (token?.name as string | undefined) ?? null,
          actorRoleSlug: actor.roleSlug,
          reason: 'Logout',
          source: 'api',
        });
      } catch (error) {
        console.error('[AUDIT] Gagal mencatat LOGOUT:', error);
      }
    },
  },
  callbacks: {
    async jwt({
      token,
      user,
      session,
      trigger,
    }: {
      token: JWT;
      user: User;
      session?: Session;
      trigger?: 'signIn' | 'signUp' | 'update';
    }) {
      if (trigger === 'update' && session?.user) {
        token = session.user;
      } else {
        if (user && user.roleId) {
          const role = await prisma.userRole.findUnique({
            where: { id: user.roleId },
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          });

          token.id = (user.id || token.sub) as string;
          token.email = user.email;
          token.name = user.name;
          token.avatar = user.avatar;
          token.status = user.status;
          token.roleId = user.roleId;
          token.role = role ? {
            id: role.id,
            name: role.name,
            slug: role.slug,
            permissions: role.permissions,
          } : undefined;
        }
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.avatar = token.avatar;
        session.user.status = token.status;
        session.user.roleId = token.roleId;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
  },
};

export default authOptions;
