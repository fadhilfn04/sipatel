import { z } from 'zod';
import { getPasswordSchema } from './password-schema';

export const getSignupSchema = () => {
  return z
    .object({
      name: z
        .string()
        .min(2, { message: 'Nama minimal 2 karakter.' })
        .min(1, { message: 'Nama wajib diisi.' }),
      email: z
        .string()
        .email({ message: 'Masukkan alamat email yang valid.' })
        .min(1, { message: 'Email wajib diisi.' }),
      nik: z
        .string()
        .min(5, { message: 'NIK minimal 5 karakter.' })
        .min(1, { message: 'NIK wajib diisi.' }),
      nama_cabang: z
        .string()
        .min(1, { message: 'Cabang wajib diisi.' }),
      password: getPasswordSchema(), // Uses the updated password schema with direct messages
      passwordConfirmation: z.string().min(1, {
        message: 'Konfirmasi kata sandi wajib diisi.',
      }),
      accept: z.boolean().refine((val) => val === true, {
        message: 'Anda harus menyetujui syarat dan ketentuan.',
      }),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
      message: 'Konfirmasi kata sandi tidak cocok.',
      path: ['passwordConfirmation'],
    });
};

export type SignupSchemaType = z.infer<ReturnType<typeof getSignupSchema>>;
