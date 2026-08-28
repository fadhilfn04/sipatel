import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/send-email';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import {
  ChangePasswordSchema,
  ChangePasswordSchemaType,
} from '@/app/(protected)/user-management/account/security/forms/change-password-schema';

export async function POST(request: NextRequest) {
  try {
    // Only authenticated users may change their own password.
    // The user is always resolved from the session, never from the request body.
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Sesi tidak valid. Silakan login kembali.' },
        { status: 401 }, // Unauthorized
      );
    }

    const clientIp = getClientIP(request);

    // Parse and validate the request body
    const body = await request.json();
    const parsedData = ChangePasswordSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        { message: 'Input tidak valid. Periksa kembali data Anda dan coba lagi.' },
        { status: 400 }, // Bad Request
      );
    }

    const { currentPassword, newPassword }: ChangePasswordSchemaType =
      parsedData.data;

    // Fetch the authenticated user from the database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Pengguna tidak ditemukan.' },
        { status: 404 }, // Not Found
      );
    }

    // Social login (OAuth) accounts do not have a local password set.
    if (!user.password) {
      return NextResponse.json(
        {
          message:
            'Akun ini menggunakan login sosial (Google) dan tidak memiliki password. Silakan gunakan fitur lupa password untuk mengaturnya.',
        },
        { status: 400 }, // Bad Request
      );
    }

    // Verify the current password before allowing the change.
    // A generic message is used to avoid leaking any sensitive information.
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { message: 'Password saat ini salah. Silakan coba lagi.' },
        { status: 401 }, // Unauthorized
      );
    }

    // Hash the new password with bcrypt (cost 10, consistent with the
    // existing signup and reset password flows) and persist it.
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Record the activity in the system log (audit trail)
    await systemLog({
      event: 'change-password',
      userId: user.id,
      entityId: user.id,
      entityType: 'user.account',
      description: 'User changed account password.',
      ipAddress: clientIp,
    });

    // Notify the user by email. A failure here must not fail the request
    // since the password has already been updated successfully.
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Changed Successfully',
        content: {
          title: `Hello, ${user.name}`,
          subtitle: 'Your password has been successfully changed.',
          description:
            'If you did not make this change, please contact the administrator immediately.',
        },
      });
    } catch (emailError) {
      console.error('Failed to send password change notification:', emailError);
    }

    return NextResponse.json(
      {
        message:
          'Password berhasil diubah. Silakan login kembali dengan password baru Anda.',
      },
      { status: 200 }, // OK
    );
  } catch {
    return NextResponse.json(
      { message: 'Terjadi kesalahan. Silakan coba lagi beberapa saat.' },
      { status: 500 }, // Internal Server Error
    );
  }
}
