import { z } from 'zod';
import { getPasswordSchema } from '@/app/(auth)/forms/password-schema';

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, {
      message: 'Password saat ini wajib diisi.',
    }),
    newPassword: getPasswordSchema(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Password baru harus berbeda dengan password saat ini.',
    path: ['newPassword'],
  });

export type ChangePasswordSchemaType = z.infer<typeof ChangePasswordSchema>;
