import { useState } from 'react';
import { Users, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Anggota } from '@/lib/supabase';
import { useCreateNikMaster, useCreateNikKepemilikan } from '@/lib/hooks/use-nik-inheritance-api';
import { toast } from 'sonner';

interface WariskanNikModalProps {
  open: boolean;
  onClose: () => void;
  anggota: Anggota | null;
}

export function WariskanNikModal({ open, onClose, anggota }: WariskanNikModalProps) {
  const [anggotaId, setAnggotaId] = useState('');
  const [hubungan, setHubungan] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState(
    new Date().toISOString().split('T')[0]
  );

  const createNikMasterMutation = useCreateNikMaster();
  const createKepemilikanMutation = useCreateNikKepemilikan();

  const handleSubmit = async () => {
    if (!anggota || !anggotaId || !hubungan || !tanggalMulai) {
      toast.error('Data tidak lengkap', {
        description: 'Silakan isi nama ahli waris, hubungan, dan tanggal mulai',
      });
      return;
    }

    try {
      // Step 1: Create NIK Master
      toast.info('Memproses...', {
        description: 'Membuat NIK master',
      });

      const nikMasterResult = await createNikMasterMutation.mutateAsync({
        nik: anggota.nik,
      });

      // Step 2: Create NIK Kepemilikan
      await createKepemilikanMutation.mutateAsync({
        nik_id: nikMasterResult.data.id,
        anggota_id: anggotaId,
        hubungan,
        status: 'aktif',
        tanggal_mulai: tanggalMulai,
        is_current: true,
      });

      toast.success('NIK berhasil diwariskan', {
        description: `NIK ${anggota.nik} telah diwariskan kepada ${anggotaId}`,
      });

      handleClose();
    } catch (error: any) {
      console.error('Error wariskan NIK:', error);
      toast.error('Gagal mewariskan NIK', {
        description: error.message || 'Terjadi kesalahan',
      });
    }
  };

  const handleClose = () => {
    setAnggotaId('');
    setHubungan('');
    setTanggalMulai(new Date().toISOString().split('T')[0]);
    onClose();
  };

  const isLoading = createNikMasterMutation.isPending || createKepemilikanMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Users className="h-6 w-6" />
            Wariskan NIK
          </DialogTitle>
          <DialogDescription>
            Wariskan NIK pensiunan kepada ahli waris. NIK akan tetap sama tidak berubah.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Info Pensiunan */}
          {anggota && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Data Pensiunan
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">NIK</span>
                  <p className="font-mono font-medium">{anggota.nik}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Nama Lengkap</span>
                  <p className="font-medium">{anggota.nama_anggota}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Cabang</span>
                  <p className="font-medium">{anggota.nama_cabang}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Status Anggota</span>
                  <p className="font-medium capitalize">{anggota.status_anggota}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form Pewarisan */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Data Pewarisan</h4>

            {/* Ahli Waris - Free text for dummy */}
            <div className="space-y-2">
              <Label htmlFor="ahli_waris">Nama Ahli Waris</Label>
              <Input
                id="ahli_waris"
                type="text"
                placeholder="Masukkan nama ahli waris"
                value={anggotaId}
                onChange={(e) => setAnggotaId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Masukkan nama lengkap ahli waris yang akan mewarisi NIK ini
              </p>
            </div>

            {/* Hubungan */}
            <div className="space-y-2">
              <Label htmlFor="hubungan">Hubungan</Label>
              <Select value={hubungan} onValueChange={setHubungan}>
                <SelectTrigger id="hubungan">
                  <SelectValue placeholder="Pilih hubungan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="istri">Istri</SelectItem>
                  <SelectItem value="suami">Suami</SelectItem>
                  <SelectItem value="anak_1">Anak 1</SelectItem>
                  <SelectItem value="anak_2">Anak 2</SelectItem>
                  <SelectItem value="anak_3">Anak 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tanggal Mulai */}
            <div className="space-y-2">
              <Label htmlFor="tanggal_mulai">Tanggal Mulai Mewarisi</Label>
              <Input
                id="tanggal_mulai"
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                Tanggal ketika ahli waris mulai mewarisi NIK
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
              Informasi Penting
            </h4>
            <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
              <li>NIK yang diwariskan tetap sama, tidak berubah</li>
              <li>Ahli waris akan memiliki kepemilikan NIK ini</li>
              <li>Status kepemilikan akan tercatat di sistem</li>
              <li>Pastikan data ahli waris sudah benar</li>
            </ul>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Batal
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!anggotaId || !hubungan || !tanggalMulai || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Wariskan NIK
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
