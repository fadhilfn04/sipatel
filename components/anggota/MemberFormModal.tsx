import { Loader2, Pencil, Plus } from 'lucide-react';
import { Anggota, CreateAnggotaInput } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MemberForm } from './MemberForm';

interface MemberFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAnggotaInput) => Promise<void>;
  member?: Anggota | null;
  mode: 'create' | 'edit';
  isPending: boolean;
}

/**
 * Modal Tambah/Edit Anggota.
 *
 * Seluruh field, validasi, dan logic formulir berada di komponen `MemberForm`
 * agar dapat dipakai ulang (mis. halaman Pendaftaran Anggota Baru) tanpa
 * menduplikasi implementasi fitur Tambah Anggota.
 */
export function MemberFormModal({
  open,
  onClose,
  onSubmit,
  member,
  mode,
  isPending,
}: MemberFormModalProps) {
  const title = mode === 'create' ? 'Tambah Anggota Baru' : 'Edit Data Anggota';
  const description =
    mode === 'create'
      ? 'Isi formulir di bawah ini untuk menambahkan anggota pensiunan baru'
      : 'Ubah data anggota pensiunan';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <MemberForm
          member={member}
          mode={mode}
          isPending={isPending}
          onSubmit={onSubmit}
          resetKey={open}
          footer={
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    {mode === 'create' ? (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Simpan Anggota
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4 mr-2" />
                        Perbarui Data
                      </>
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
