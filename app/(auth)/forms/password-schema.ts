import { z } from 'zod';

export const getPasswordSchema = (minLength = 8) => {
  return z
    .string()
    .min(minLength, {
      message: `Kata sandi minimal ${minLength} karakter.`,
    })
    .regex(/[A-Z]/, {
      message: 'Kata sandi harus mengandung setidaknya satu huruf kapital.',
    })
    .regex(/[a-z]/, {
      message: 'Kata sandi harus mengandung setidaknya satu huruf kecil.',
    })
    .regex(/\d/, {
      message: 'Kata sandi harus mengandung setidaknya satu angka.',
    })
    .regex(/[!@#$%^&*(),.?":{}|<>]/, {
      message:
        'Kata sandi harus mengandung setidaknya satu karakter khusus (!@#$% dll).',
    });
};
