import { z } from 'zod';

export const getSigninSchema = () => {
  return z.object({
    email: z
      .string()
      .email({ message: 'Masukkan alamat email yang valid.' })
      .min(1, { message: 'Email wajib diisi.' }),
    password: z
      .string()
      .min(6, { message: 'Kata sandi minimal 6 karakter.' })
      .min(1, { message: 'Kata sandi wajib diisi.' }),
    rememberMe: z.boolean().optional(),
  });
};

export type SigninSchemaType = z.infer<ReturnType<typeof getSigninSchema>>;
