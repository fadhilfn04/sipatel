import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';

interface ImportExcelModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<{ success: number; error: number }>;
}

export function ImportExcelModal({ open, onClose, onImport }: ImportExcelModalProps) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      await parseExcelFile(file);
    }
  };

  const parseExcelFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx');

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        blankrows: false
      });

      if (jsonData.length === 0) {
        toast.error('File kosong atau tidak ada data', {
          description: 'Silakan upload file yang berisi data anggota',
          icon: <AlertCircle className="h-4 w-4" />
        });
        return;
      }

      // Map and validate data with new field structure
      const mappedData = jsonData.map((row: any) => ({
        nik: String(row.nik || row['NIK'] || '').trim(),
        nama_anggota: String(row.nama_anggota || row['Nama Anggota'] || row['nama'] || row['Nama'] || '').trim(),
        kategori_anggota: row.kategori_anggota || row['Kategori Anggota'] || 'biasa',
        status_anggota: row.status_anggota || row['Status Anggota'] || 'pegawai',
        status_mps: row.status_mps || row['Status MPS'] || 'non_mps',
        status_iuran: row.status_iuran || row['Status Iuran'] || 'belum_ttd',
        nama_cabang: String(row.nama_cabang || row['Nama Cabang'] || row['cabang'] || row['Cabang'] || '').trim(),
        posisi_kepengurusan: String(row.posisi_kepengurusan || row['Posisi Kepengurusan'] || 'Anggota').trim(),
        status_kepesertaan: row.status_kepesertaan || row['Status Kepesertaan'] || '',
        cabang_kelas: row.cabang_kelas || row['Cabang Kelas'] || '',
        cabang_area_regional: row.cabang_area_regional || row['Cabang Area Regional'] || '',
        cabang_area_witel: row.cabang_area_witel || row['Cabang Area Witel'] || '',
        pasutri: row.pasutri || row['Pasutri'] || '',
        status_perkawinan: row.status_perkawinan || row['Status Perkawinan'] || 'kawin',
        sk_pensiun: row.sk_pensiun || row['SK Pensiun'] || 'pensiun',
        nomor_sk_pensiun: String(row.nomor_sk_pensiun || row['Nomor SK Pensiun'] || '').trim(),
        alamat: String(row.alamat || row['Alamat'] || '').trim(),
        rt: String(row.rt || row['RT'] || '').trim(),
        rw: String(row.rw || row['RW'] || '').trim(),
        kelurahan: String(row.kelurahan || row['Kelurahan'] || '').trim(),
        kecamatan: String(row.kecamatan || row['Kecamatan'] || '').trim(),
        provinsi: String(row.provinsi || row['Provinsi'] || '').trim(),
        kota: String(row.kota || row['Kota'] || '').trim(),
        kode_pos: String(row.kode_pos || row['Kode Pos'] || '').trim(),
        nomor_handphone: String(row.nomor_handphone || row['Nomor Handphone'] || row['no_hp'] || '').trim(),
        nomor_telepon: String(row.nomor_telepon || row['Nomor Telepon'] || '').trim(),
        email: String(row.email || row['Email'] || '').trim(),
        sosial_media: String(row.sosial_media || row['Sosial Media'] || '').trim(),
        e_ktp: String(row.e_ktp || row['E-KTP'] || '').trim(),
        kartu_keluarga: String(row.kartu_keluarga || row['Kartu Keluarga'] || row['kk'] || '').trim(),
        npwp: String(row.npwp || row['NPWP'] || '').trim(),
        tempat_lahir: String(row.tempat_lahir || row['Tempat Lahir'] || '').trim(),
        tanggal_lahir: row.tanggal_lahir || row['Tanggal Lahir'] || '',
        jenis_kelamin: row.jenis_kelamin || row['Jenis Kelamin'] || 'laki_laki',
        agama: row.agama || row['Agama'] || 'islam',
        golongan_darah: row.golongan_darah || row['Golongan Darah'] || 'A',
        besaran_iuran: parseFloat(row.besaran_iuran || row['Besaran Iuran'] || '0') || 0,
        form_kesediaan_iuran: row.form_kesediaan_iuran === 'true' || row.form_kesediaan_iuran === true || row['Form Kesediaan Iuran'] === 'Ya' || false,
        nama_bank: row.nama_bank || row['Nama Bank'] || '',
        norek_bank: String(row.norek_bank || row['Nomor Rekening'] || row['No Rek'] || '').trim(),
        kategori_bantuan: row.kategori_bantuan || row['Kategori Bantuan'] || '',
        tanggal_terima_bantuan: row.tanggal_terima_bantuan || row['Tanggal Terima Bantuan'] || '',
        gambar_kondisi_tempat_tinggal: String(row.gambar_kondisi_tempat_tinggal || row['Gambar Kondisi'] || '').trim(),
        alasan_mutasi: row.alasan_mutasi || row['Alasan Mutasi'] || '',
        tanggal_mutasi: row.tanggal_mutasi || row['Tanggal Mutasi'] || '',
        cabang_pengajuan_mutasi: row.cabang_pengajuan_mutasi || row['Cabang Pengajuan Mutasi'] || '',
        pusat_pengesahan_mutasi: row.pusat_pengesahan_mutasi || row['Pusat Pengesahan Mutasi'] || '',
        status_bpjs: row.status_bpjs === 'true' || row.status_bpjs === true || row['Status BPJS'] === 'Aktif' || false,
        bpjs_kelas: row.bpjs_kelas || row['Kelas BPJS'] || '',
        bpjs_insentif: row.bpjs_insentif === 'true' || row.bpjs_insentif === true || false,
        kategori_datul: row.kategori_datul || row['Kategori Datul'] || '',
        media_datul: row.media_datul || row['Media Datul'] || '',
      }));

      // Validate required fields (only 3 fields required)
      const validData = mappedData.filter((item: any) => {
        return item.nik && item.nama_anggota && item.nama_cabang;
      });

      const invalidCount = mappedData.length - validData.length;

      if (invalidCount > 0) {
        toast.warning(`${invalidCount} baris dilewati`, {
          description: 'Data tidak lengkap: NIK, Nama Anggota, dan Nama Cabang wajib diisi',
          icon: <AlertCircle className="h-4 w-4" />
        });
      }

      if (validData.length > 0) {
        toast.success(`Berhasil memuat ${validData.length} data anggota`, {
          description: invalidCount > 0
            ? `${invalidCount} baris dilewati karena data tidak lengkap`
            : 'Semua data valid dan siap diimport',
          icon: <CheckCircle className="h-4 w-4" />
        });
      } else {
        toast.error('Tidak ada data valid', {
          description: 'Pastikan NIK, Nama Anggota, dan Nama Cabang terisi',
          icon: <AlertCircle className="h-4 w-4" />
        });
      }

      setImportPreview(validData);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Gagal memparse file Excel', {
        description: 'Pastikan format file benar (.xlsx, .xls, atau .csv)',
        icon: <AlertCircle className="h-4 w-4" />
      });
    }
  };

  const handleImport = async () => {
    if (!importFile || importPreview.length === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: importPreview.length });

    try {
      const result = await onImport(importPreview);

      if (result.success > 0) {
        toast.success('Import berhasil!', {
          description: `${result.success} data anggota berhasil ditambahkan${result.error > 0 ? ` dan ${result.error} gagal` : ''}`,
          icon: <CheckCircle className="h-4 w-4" />
        });
      }

      if (result.error > 0 && result.success === 0) {
        toast.error('Import gagal', {
          description: `${result.error} data gagal diimport. Silakan coba lagi.`,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }

      handleClose();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Gagal mengimpor data', {
        description: 'Terjadi kesalahan saat memproses data. Silakan coba lagi.',
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');

      // Create template data with minimal required fields
      const templateData = [
        {
          'nik': '3201123456789012',
          'nama_anggota': 'Contoh Nama Anggota',
          'nama_cabang': 'Cabang Jakarta',
          'kategori_anggota': 'biasa',
          'status_anggota': 'pegawai',
          'status_mps': 'non_mps',
          'status_iuran': 'belum_ttd',
          'posisi_kepengurusan': 'Anggota',
          'status_kepesertaan': 'Aktif',
          'cabang_kelas': 'A',
          'cabang_area_regional': 'Regional 1',
          'cabang_area_witel': 'Witel Jakarta',
          'pasutri': '',
          'status_perkawinan': 'kawin',
          'sk_pensiun': 'pensiun',
          'nomor_sk_pensiun': 'SKP-12345',
          'alamat': 'Jl. Contoh No. 123',
          'rt': '001',
          'rw': '001',
          'kelurahan': 'Contoh',
          'kecamatan': 'Contoh',
          'provinsi': 'DKI Jakarta',
          'kota': 'Jakarta Selatan',
          'kode_pos': '12345',
          'nomor_handphone': '08123456789',
          'nomor_telepon': '0211234567',
          'email': 'contoh@email.com',
          'sosial_media': '@username',
          'e_ktp': '3201123456789012',
          'kartu_keluarga': '1234567890123456',
          'npwp': '123456789012345',
          'tempat_lahir': 'Jakarta',
          'tanggal_lahir': '1960-01-01',
          'jenis_kelamin': 'laki_laki',
          'agama': 'islam',
          'golongan_darah': 'A',
          'besaran_iuran': '100000',
          'form_kesediaan_iuran': 'true',
          'nama_bank': 'BCA',
          'norek_bank': '1234567890',
          'kategori_bantuan': '',
          'tanggal_terima_bantuan': '',
          'gambar_kondisi_tempat_tinggal': '',
          'alasan_mutasi': '',
          'tanggal_mutasi': '',
          'cabang_pengajuan_mutasi': '',
          'pusat_pengesahan_mutasi': '',
          'status_bpjs': 'true',
          'bpjs_kelas': '1',
          'bpjs_insentif': 'false',
          'kategori_datul': '',
          'media_datul': ''
        }
      ];

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(templateData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 5 },
        { wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
        { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 },
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 15 },
      ];

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

      // Generate and download file
      XLSX.writeFile(workbook, 'template_import_anggota.xlsx');

      toast.success('Template berhasil diunduh', {
        description: 'Gunakan template ini untuk mengisi data anggota. Field wajib: NIK, Nama Anggota, Nama Cabang',
        icon: <CheckCircle className="h-4 w-4" />
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Gagal mengunduh template', {
        description: 'Terjadi kesalahan saat mengunduh template. Silakan coba lagi.',
        icon: <AlertCircle className="h-4 w-4" />
      });
    }
  };

  const handleClose = () => {
    setImportFile(null);
    setImportPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Import Data Anggota dari Excel
          </DialogTitle>
          <DialogDescription>
            Upload file Excel untuk menambahkan data anggota secara massal
          </DialogDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="mt-2"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download Template Excel
          </Button>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Klik untuk upload atau drag & drop</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Excel (.xlsx, .xls) atau CSV
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {importFile && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">{importFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(importFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview([]);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    ×
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Required Fields Info */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Field Wajib (Required)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800 dark:text-blue-200">nik</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800 dark:text-blue-200">nama_anggota</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800 dark:text-blue-200">nama_cabang</span>
              </div>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              Field lain akan diisi dengan nilai default jika tidak ada di Excel
            </p>
          </div>

          {/* Preview Section */}
          {importPreview.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Preview Data ({importPreview.length} baris)</h4>

              {importing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Memproses data...</span>
                    <span className="font-medium">
                      {importProgress.current} / {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(importProgress.current / importProgress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">No</th>
                        <th className="px-3 py-2 text-left font-medium">NIK</th>
                        <th className="px-3 py-2 text-left font-medium">Nama Anggota</th>
                        <th className="px-3 py-2 text-left font-medium">Cabang</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 10).map((row, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">{index + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.nik || '-'}</td>
                          <td className="px-3 py-2">{row.nama_anggota || '-'}</td>
                          <td className="px-3 py-2">{row.nama_cabang || '-'}</td>
                          <td className="px-3 py-2">
                            {row.nik && row.nama_anggota && row.nama_cabang ? (
                              <Badge variant="success" appearance="ghost" className="text-xs">
                                Valid
                              </Badge>
                            ) : (
                              <Badge variant="destructive" appearance="ghost" className="text-xs">
                                Incomplete
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 10 && (
                    <div className="px-3 py-2 bg-muted text-xs text-center">
                      Menampilkan 10 dari {importPreview.length} baris
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={importing}>
              Batal
            </Button>
          </DialogClose>
          <Button
            onClick={handleImport}
            disabled={!importFile || importPreview.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Mengimport...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {importPreview.length} Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
