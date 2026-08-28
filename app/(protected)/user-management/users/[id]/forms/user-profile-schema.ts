import { z } from 'zod';

export const UserProfileSchema = z.object({
  name: z.string().nonempty({
    message: 'Nama wajib diisi.',
  }),
  roleId: z.string().nonempty({
    message: 'Role ID is required.',
  }),
  status: z.string().nonempty({
    message: 'Status is required.',
  }),
});

export type UserProfileSchemaType = z.infer<typeof UserProfileSchema>;
