'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LoaderCircleIcon } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  ChangePasswordSchema,
  ChangePasswordSchemaType,
} from '../forms/change-password-schema';

const ChangePasswordForm = () => {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const form = useForm<ChangePasswordSchemaType>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: ChangePasswordSchemaType) {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await apiFetch(
        '/api/user-management/account/security',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update password.');
      }

      toast.success('Kata sandi berhasil diubah. Mengalihkan ke halaman masuk…', {
        position: 'top-center',
      });

      // Sign the user out so the next sign in uses the new password
      setTimeout(() => {
        signOut({ callbackUrl: '/signin' });
      }, 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Gagal mengubah kata sandi.';
      setError(message);
      toast.error(message, { position: 'top-center' });
    } finally {
      setIsProcessing(false);
    }
  }

  const passwordFields = [
    {
      name: 'currentPassword' as const,
      label: 'Kata Sandi Saat Ini',
      placeholder: 'Masukkan kata sandi saat ini',
      visible: currentPasswordVisible,
      toggle: () => setCurrentPasswordVisible(!currentPasswordVisible),
    },
    {
      name: 'newPassword' as const,
      label: 'Kata Sandi Baru',
      placeholder: 'Masukkan kata sandi baru',
      visible: newPasswordVisible,
      toggle: () => setNewPasswordVisible(!newPasswordVisible),
    },
    {
      name: 'confirmPassword' as const,
      label: 'Konfirmasi Kata Sandi Baru',
      placeholder: 'Konfirmasi kata sandi baru',
      visible: confirmPasswordVisible,
      toggle: () => setConfirmPasswordVisible(!confirmPasswordVisible),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle>Kata Sandi</CardTitle>
          <CardDescription>
            Perbarui kata sandi Anda secara berkala untuk menjaga keamanan
            akun. Anda akan keluar otomatis setelah mengubah kata sandi.
          </CardDescription>
        </CardHeading>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="max-w-xl space-y-5"
          >
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {passwordFields.map(
              ({ name, label, placeholder, visible, toggle }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={visible ? 'text' : 'password'}
                            placeholder={placeholder}
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          mode="icon"
                          onClick={toggle}
                          className="absolute end-0 top-1/2 h-7 w-7 -translate-y-1/2 bg-transparent! me-1.5"
                          aria-label={
                            visible
                              ? 'Sembunyikan kata sandi'
                              : 'Tampilkan kata sandi'
                          }
                        >
                          {visible ? (
                            <EyeOff className="text-muted-foreground" />
                          ) : (
                            <Eye className="text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ),
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!form.formState.isDirty || isProcessing}
              >
                {isProcessing && (
                  <LoaderCircleIcon className="animate-spin" />
                )}
                Ubah Kata Sandi
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ChangePasswordForm;
