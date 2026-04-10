import { useState } from 'react';
import { User, FileText, MapPin, Phone, Mail, Building, Users } from 'lucide-react';
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
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Anggota } from '@/lib/supabase';
import { WariskanNikModal } from './WariskanNikModal';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  member: Anggota | null;
  onWariskanNik?: (anggota: Anggota) => void;
}

interface StatusProps {
  variant: 'success' | 'warning' | 'destructive' | 'secondary';
  label: string;
}

export function DetailModal({ open, onClose, member, onWariskanNik }: DetailModalProps) {
  const [wariskanModalOpen, setWariskanModalOpen] = useState(false);

  if (!member) return null;

  const getKategoriAnggotaProps = (kategori: Anggota['kategori_anggota']): StatusProps => {
    const kategoriMap: Record<string, StatusProps> = {
      biasa: { variant: 'success', label: 'Biasa' },
      luar_biasa: { variant: 'warning', label: 'Luar Biasa' },
      kehormatan: { variant: 'warning', label: 'Kehormatan' },
      bukan_anggota: { variant: 'secondary', label: 'Bukan Anggota' },
    };
    return kategoriMap[kategori] || { variant: 'secondary', label: kategori };
  };

  const getStatusAnggotaProps = (status: Anggota['status_anggota']): StatusProps => {
    const statusMap: Record<string, StatusProps> = {
      pegawai: { variant: 'success', label: 'Pegawai' },
      istri: { variant: 'warning', label: 'Istri' },
      suami: { variant: 'warning', label: 'Suami' },
      anak: { variant: 'secondary', label: 'Anak' },
      meninggal: { variant: 'destructive', label: 'Meninggal' },
    };
    return statusMap[status] || { variant: 'secondary', label: status };
  };

  const getStatusMpsProps = (status: Anggota['status_mps']): StatusProps => {
    return status === 'mps'
      ? { variant: 'success', label: 'MPS' }
      : { variant: 'secondary', label: 'Non-MPS' };
  };

  const getStatusIuranProps = (status: Anggota['status_iuran']): StatusProps => {
    const statusMap: Record<string, StatusProps> = {
      sudah_ttd: { variant: 'success', label: 'Sudah TTD' },
      belum_ttd: { variant: 'warning', label: 'Belum TTD' },
      tidak_iuran: { variant: 'secondary', label: 'Tidak Iuran' },
    };
    return statusMap[status] || { variant: 'secondary', label: status };
  };

  const getSkPensiunLabel = (sk: Anggota['sk_pensiun']) => {
    const skMap: Record<string, string> = {
      pensiun: 'Pensiun',
      janda: 'Janda',
      duda: 'Duda',
      anak: 'Anak',
    };
    return skMap[sk || ''] || sk || '-';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Detail Anggota</DialogTitle>
          <DialogDescription>
            Informasi lengkap mengenai data anggota pensiunan
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Kategori</div>
              <Badge variant={getKategoriAnggotaProps(member.kategori_anggota).variant} appearance="ghost">
                <BadgeDot />
                {getKategoriAnggotaProps(member.kategori_anggota).label}
              </Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Status Anggota</div>
              <Badge variant={getStatusAnggotaProps(member.status_anggota).variant} appearance="ghost">
                <BadgeDot />
                {getStatusAnggotaProps(member.status_anggota).label}
              </Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Status MPS</div>
              <Badge variant={getStatusMpsProps(member.status_mps).variant} appearance="ghost">
                <BadgeDot />
                {getStatusMpsProps(member.status_mps).label}
              </Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Status Iuran</div>
              <Badge variant={getStatusIuranProps(member.status_iuran).variant} appearance="ghost">
                <BadgeDot />
                {getStatusIuranProps(member.status_iuran).label}
              </Badge>
            </div>
          </div>

          {/* Informasi Pribadi */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Informasi Pribadi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">NIK</label>
                <div className="font-mono text-sm font-medium">{member.nik}</div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-muted-foreground">Nama Lengkap</label>
                <div className="font-medium">{member.nama_anggota}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Tempat Lahir</label>
                <div className="text-sm">{member.tempat_lahir || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Tanggal Lahir</label>
                <div className="text-sm">{member.tanggal_lahir || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Jenis Kelamin</label>
                <div className="text-sm">{member.jenis_kelamin === 'laki_laki' ? 'Laki-laki' : member.jenis_kelamin === 'perempuan' ? 'Perempuan' : '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Agama</label>
                <div className="text-sm capitalize">{member.agama || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Golongan Darah</label>
                <div className="text-sm">{member.golongan_darah || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Status Perkawinan</label>
                <div className="text-sm">{member.status_perkawinan || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Pasutri</label>
                <div className="text-sm">{member.pasutri || '-'}</div>
              </div>
            </div>
          </div>

          {/* Informasi Organisasi */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informasi Organisasi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Nama Cabang</label>
                <div className="text-sm font-medium">{member.nama_cabang}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Posisi Kepengurusan</label>
                <div className="text-sm">{member.posisi_kepengurusan}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">SK Pensiun</label>
                <div className="text-sm">{getSkPensiunLabel(member.sk_pensiun)}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nomor SK Pensiun</label>
                <div className="text-sm">{member.nomor_sk_pensiun || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Status Kepesertaan</label>
                <div className="text-sm">{member.status_kepesertaan || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Pasutri</label>
                <div className="text-sm">{member.pasutri || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Cabang Kelas</label>
                <div className="text-sm">{member.cabang_kelas || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Area Regional</label>
                <div className="text-sm">{member.cabang_area_regional || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Area Witel</label>
                <div className="text-sm">{member.cabang_area_witel || '-'}</div>
              </div>
            </div>
          </div>

          {/* Dokumen */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dokumen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">E-KTP</label>
                <div className="text-sm">{member.e_ktp || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Kartu Keluarga</label>
                <div className="text-sm">{member.kartu_keluarga || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">NPWP</label>
                <div className="text-sm">{member.npwp || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nomor SK Pensiun</label>
                <div className="text-sm">{member.nomor_sk_pensiun || '-'}</div>
              </div>
            </div>
          </div>

          {/* Data Keuangan */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Data Keuangan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Besaran Iuran</label>
                <div className="text-sm">{member.besaran_iuran ? `Rp ${member.besaran_iuran.toLocaleString()}` : '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Form Kesediaan Iuran</label>
                <div className="text-sm">{member.form_kesediaan_iuran ? 'Ya' : 'Tidak'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nama Bank</label>
                <div className="text-sm">{member.nama_bank || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nomor Rekening</label>
                <div className="text-sm">{member.norek_bank || '-'}</div>
              </div>
            </div>
          </div>

          {/* Data BPJS */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Data BPJS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Status BPJS</label>
                <div className="text-sm">{member.status_bpjs ? 'Aktif' : 'Tidak Aktif'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Kelas BPJS</label>
                <div className="text-sm">{member.bpjs_kelas || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Insentif BPJS</label>
                <div className="text-sm">{member.bpjs_insentif ? 'Ya' : 'Tidak'}</div>
              </div>
            </div>
          </div>

          {/* Bantuan Sosial */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bantuan Sosial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Kategori Bantuan</label>
                <div className="text-sm">{member.kategori_bantuan || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Tanggal Terima Bantuan</label>
                <div className="text-sm">{member.tanggal_terima_bantuan || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Gambar Kondisi Tempat Tinggal</label>
                <div className="text-sm">{member.gambar_kondisi_tempat_tinggal ? 'Ada' : '-'}</div>
              </div>
            </div>
          </div>

          {/* Mutasi */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Data Mutasi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Alasan Mutasi</label>
                <div className="text-sm">{member.alasan_mutasi || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Tanggal Mutasi</label>
                <div className="text-sm">{member.tanggal_mutasi || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Cabang Pengajuan Mutasi</label>
                <div className="text-sm">{member.cabang_pengajuan_mutasi || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Pusat Pengesahan Mutasi</label>
                <div className="text-sm">{member.pusat_pengesahan_mutasi || '-'}</div>
              </div>
            </div>
          </div>

          {/* Kontak & Alamat */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Kontak & Alamat
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Nomor Handphone</label>
                <div className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {member.nomor_handphone || '-'}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nomor Telepon</label>
                <div className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {member.nomor_telepon || '-'}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <div className="text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {member.email || '-'}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Sosial Media</label>
                <div className="text-sm">{member.sosial_media || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Kategori Datul</label>
                <div className="text-sm">{member.kategori_datul || '-'}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Media Datul</label>
                <div className="text-sm">{member.media_datul || '-'}</div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-muted-foreground">Alamat Lengkap</label>
                <div className="text-sm">
                  {member.alamat}
                  {member.rt && ` RT ${member.rt}`}
                  {member.rw && `/RW ${member.rw}`}
                  {member.kelurahan && `, Kel. ${member.kelurahan}`}
                  {member.kecamatan && `, Kec. ${member.kecamatan}`}
                  {member.kota && `, ${member.kota}`}
                  {member.provinsi && `, ${member.provinsi}`}
                  {member.kode_pos && ` ${member.kode_pos}`}
                </div>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          {member.status_anggota === 'meninggal' && (
            <Button
              variant="primary"
              onClick={() => {
                if (onWariskanNik) {
                  onWariskanNik(member);
                } else {
                  setWariskanModalOpen(true);
                }
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Wariskan NIK
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="outline">Tutup</Button>
          </DialogClose>
        </DialogFooter>

        {/* Wariskan NIK Modal */}
        {onWariskanNik ? null : (
          <WariskanNikModal
            open={wariskanModalOpen}
            onClose={() => setWariskanModalOpen(false)}
            anggota={member}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
