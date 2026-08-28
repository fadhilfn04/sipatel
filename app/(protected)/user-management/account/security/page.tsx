'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { comingSoonToast } from '@/components/common/coming-soon-toast';
import ChangePasswordForm from './components/change-password-form';
import { useAccount } from '../components/account-context';

export default function Page() {
  const { user } = useAccount();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CardDescription>
            Alamat utama yang Anda gunakan untuk masuk ke SIPATEL. Alamat ini akan digunakan untuk menerima notifikasi terkait akun.
          </CardDescription>

          <div className="flex items-center gap-2.5 rounded-lg bg-accent/60 p-4 text-sm">
            <span className="font-medium">{user.email}</span>{' '}
            {user.emailVerifiedAt && (
              <Badge variant="success" appearance="light">
                Terverifikasi
              </Badge>
            )}
          </div>

          <Button variant="outline" onClick={() => comingSoonToast()}>
            Ubah Email
          </Button>
        </CardContent>
      </Card>

      <ChangePasswordForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Hapus Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CardDescription>
            Hapus Akun Pribadi Anda secara permanen beserta seluruh data di dalamnya dari platform SIPATEL. 
            Tindakan ini tidak dapat dibatalkan, jadi harap lanjutkan dengan hati-hati.
          </CardDescription>

          <Button variant="destructive" onClick={() => comingSoonToast()}>
            Hapus Akun
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
