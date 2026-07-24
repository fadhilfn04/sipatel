import { useState } from 'react';
import { FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ExportExcelModalProps {
  open: boolean;
  onClose: () => void;
  data: any[];
  totalCount?: number;
  onFetchAllData?: (limit?: number) => Promise<any[]>;
}

type FieldConfig = {
  key: string;
  label: string;
  required: boolean;
  category: string;
};

export function ExportExcelModal({ open, onClose, data, totalCount, onFetchAllData }: ExportExcelModalProps) {
  const [exporting, setExporting] = useState(false);

  // Export options state
  const [exportOption, setExportOption] = useState<'current' | 'all' | 'custom'>('current');
  const [customLimit, setCustomLimit] = useState<number>(100);
  const [customLimitInput, setCustomLimitInput] = useState<string>('100');

  // Define all available fields with categories
  const fieldConfigs: FieldConfig[] = [
    // Basic Info (Required)
    { key: 'nik', label: 'NIK', required: true, category: 'Informasi Dasar (Wajib)' },
    { key: 'nama_anggota', label: 'Nama Anggota', required: true, category: 'Informasi Dasar (Wajib)' },
    { key: 'nama_cabang', label: 'Nama Cabang', required: true, category: 'Informasi Dasar (Wajib)' },

    // Kategori & Status
    { key: 'kategori_anggota', label: 'Kategori Anggota', required: false, category: 'Kategori & Status' },
    { key: 'status_anggota', label: 'Status Anggota', required: false, category: 'Kategori & Status' },
    { key: 'status_mps', label: 'Status MPS', required: false, category: 'Kategori & Status' },
    { key: 'status_iuran', label: 'Status Iuran', required: false, category: 'Kategori & Status' },
    { key: 'posisi_kepengurusan', label: 'Posisi Kepengurusan', required: false, category: 'Kategori & Status' },
    { key: 'status_kepesertaan', label: 'Status Kepesertaan', required: false, category: 'Kategori & Status' },

    // Informasi Cabang
    { key: 'cabang_kelas', label: 'Cabang Kelas', required: false, category: 'Informasi Cabang' },
    { key: 'cabang_area_regional', label: 'Cabang Area Regional', required: false, category: 'Informasi Cabang' },
    { key: 'cabang_area_witel', label: 'Cabang Area Witel', required: false, category: 'Informasi Cabang' },

    // Status Perkawinan & Keluarga
    { key: 'pasutri', label: 'Pasutri', required: false, category: 'Status Perkawinan & Keluarga' },
    { key: 'status_perkawinan', label: 'Status Perkawinan', required: false, category: 'Status Perkawinan & Keluarga' },

    // Informasi Pensiun
    { key: 'sk_pensiun', label: 'SK Pensiun', required: false, category: 'Informasi Pensiun' },
    { key: 'nomor_sk_pensiun', label: 'Nomor SK Pensiun', required: false, category: 'Informasi Pensiun' },

    // Alamat Lengkap
    { key: 'alamat', label: 'Alamat', required: false, category: 'Alamat Lengkap' },
    { key: 'rt', label: 'RT', required: false, category: 'Alamat Lengkap' },
    { key: 'rw', label: 'RW', required: false, category: 'Alamat Lengkap' },
    { key: 'kelurahan', label: 'Kelurahan', required: false, category: 'Alamat Lengkap' },
    { key: 'kecamatan', label: 'Kecamatan', required: false, category: 'Alamat Lengkap' },
    { key: 'provinsi', label: 'Provinsi', required: false, category: 'Alamat Lengkap' },
    { key: 'kota', label: 'Kota', required: false, category: 'Alamat Lengkap' },
    { key: 'kode_pos', label: 'Kode Pos', required: false, category: 'Alamat Lengkap' },

    // Kontak
    { key: 'nomor_handphone', label: 'Nomor Handphone', required: false, category: 'Kontak' },
    { key: 'nomor_telepon', label: 'Nomor Telepon', required: false, category: 'Kontak' },
    { key: 'email', label: 'Email', required: false, category: 'Kontak' },
    { key: 'sosial_media', label: 'Sosial Media', required: false, category: 'Kontak' },

    // Dokumen Identitas
    { key: 'e_ktp', label: 'E-KTP', required: false, category: 'Dokumen Identitas' },
    { key: 'kartu_keluarga', label: 'Kartu Keluarga', required: false, category: 'Dokumen Identitas' },
    { key: 'npwp', label: 'NPWP', required: false, category: 'Dokumen Identitas' },

    // Informasi Pribadi
    { key: 'tempat_lahir', label: 'Tempat Lahir', required: false, category: 'Informasi Pribadi' },
    { key: 'tanggal_lahir', label: 'Tanggal Lahir', required: false, category: 'Informasi Pribadi' },
    { key: 'jenis_kelamin', label: 'Jenis Kelamin', required: false, category: 'Informasi Pribadi' },
    { key: 'agama', label: 'Agama', required: false, category: 'Informasi Pribadi' },
    { key: 'golongan_darah', label: 'Golongan Darah', required: false, category: 'Informasi Pribadi' },

    // Informasi Iuran
    { key: 'besaran_iuran', label: 'Besaran Iuran', required: false, category: 'Informasi Iuran' },
    { key: 'form_kesediaan_iuran', label: 'Form Kesediaan Iuran', required: false, category: 'Informasi Iuran' },

    // Informasi Bank
    { key: 'nama_bank', label: 'Nama Bank', required: false, category: 'Informasi Bank' },
    { key: 'norek_bank', label: 'Nomor Rekening', required: false, category: 'Informasi Bank' },

    // Informasi Bantuan
    { key: 'kategori_bantuan', label: 'Kategori Bantuan', required: false, category: 'Informasi Bantuan' },
    { key: 'tanggal_terima_bantuan', label: 'Tanggal Terima Bantuan', required: false, category: 'Informasi Bantuan' },
    { key: 'gambar_kondisi_tempat_tinggal', label: 'Gambar Kondisi Tempat Tinggal', required: false, category: 'Informasi Bantuan' },

    // Informasi Mutasi
    { key: 'alasan_mutasi', label: 'Alasan Mutasi', required: false, category: 'Informasi Mutasi' },
    { key: 'tanggal_mutasi', label: 'Tanggal Mutasi', required: false, category: 'Informasi Mutasi' },
    { key: 'cabang_pengajuan_mutasi', label: 'Cabang Pengajuan Mutasi', required: false, category: 'Informasi Mutasi' },
    { key: 'pusat_pengesahan_mutasi', label: 'Pusat Pengesahan Mutasi', required: false, category: 'Informasi Mutasi' },

    // Informasi BPJS
    { key: 'status_bpjs', label: 'Status BPJS', required: false, category: 'Informasi BPJS' },
    { key: 'bpjs_kelas', label: 'Kelas BPJS', required: false, category: 'Informasi BPJS' },
    { key: 'bpjs_insentif', label: 'BPJS Insentif', required: false, category: 'Informasi BPJS' },

    // Informasi Datul
    { key: 'kategori_datul', label: 'Kategori Datul', required: false, category: 'Informasi Datul' },
    { key: 'media_datul', label: 'Media Datul', required: false, category: 'Informasi Datul' },
  ];

  // Default: all fields selected so user gets complete data by default
  const allFieldKeys = fieldConfigs.map((f) => f.key);
  const [selectedFields, setSelectedFields] = useState<string[]>(allFieldKeys);

  // Group fields by category
  const fieldsByCategory = fieldConfigs.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldConfig[]>);

  const handleFieldToggle = (fieldKey: string) => {
    const field = fieldConfigs.find(f => f.key === fieldKey);
    if (field?.required) return; // Cannot toggle required fields

    setSelectedFields(prev => {
      if (prev.includes(fieldKey)) {
        // Prevent deselecting if it would leave only required fields
        const remainingFields = prev.filter(f => f !== fieldKey);
        if (remainingFields.length === 3) {
          toast.error('Tidak bisa menghapus semua field opsional', {
            description: 'Minimal harus ada satu field opsional selain field wajib',
            icon: <AlertCircle className="h-4 w-4" />
          });
          return prev;
        }
        return remainingFields;
      } else {
        return [...prev, fieldKey];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedFields(allFieldKeys);
  };

  const handleDeselectAll = () => {
    setSelectedFields(['nik', 'nama_anggota', 'nama_cabang']);
  };

  const handleExport = async () => {
    if (data.length === 0 && exportOption === 'current') {
      toast.error('Tidak ada data untuk diexport', {
        description: 'Data anggota kosong',
        icon: <AlertCircle className="h-4 w-4" />
      });
      return;
    }

    setExporting(true);

    try {
      const XLSX = await import('xlsx');

      let exportData: any[] = [];
      let dataSource = '';

      // Determine data source based on export option
      if (exportOption === 'current') {
        exportData = data;
        dataSource = `di halaman ini (${data.length} data)`;
      } else if (exportOption === 'all' && onFetchAllData) {
        exportData = await onFetchAllData();
        dataSource = `semua data (${exportData.length} data)`;
      } else if (exportOption === 'custom' && onFetchAllData) {
        exportData = await onFetchAllData(customLimit);
        dataSource = `${customLimit} data teratas`;
      }

      if (exportData.length === 0) {
        toast.error('Tidak ada data untuk diexport', {
          description: 'Data anggota kosong',
          icon: <AlertCircle className="h-4 w-4" />
        });
        return;
      }

      // Transform data to include only selected fields
      const transformedData = exportData.map(item => {
        const row: any = {};
        selectedFields.forEach(field => {
          row[field] = item[field] || '';
        });
        return row;
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(transformedData);

      // Create headers with better formatting
      const headers = selectedFields.map(field => {
        const fieldConfig = fieldConfigs.find(f => f.key === field);
        return fieldConfig?.label || field;
      });

      // Set column widths based on content
      const colWidths = selectedFields.map(field => {
        const maxLength = Math.max(
          field.length,
          ...transformedData.map(row => String(row[field] || '').length)
        );
        return { wch: Math.min(Math.max(maxLength + 2, 15), 50) };
      });
      worksheet['!cols'] = colWidths;

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Anggota');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `data_anggota_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast.success('Export berhasil!', {
        description: `${transformedData.length} data anggota (${dataSource}) berhasil diexport ke ${filename}. ${selectedFields.length} kolom termasuk field wajib.`,
        icon: <CheckCircle className="h-4 w-4" />
      });

      handleClose();
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Gagal menexport data', {
        description: 'Terjadi kesalahan saat menexport data. Silakan coba lagi.',
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFields(allFieldKeys);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Export Data Anggota ke Excel
          </DialogTitle>
          <DialogDescription>
            Pilih field yang ingin diexport. NIK, Nama Anggota, dan Nama Cabang adalah field wajib.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
          {/* Stats */}
          <div className="bg-muted/50 rounded-lg p-4 shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-medium">Total Data di Halaman: <span className="text-primary">{data.length}</span> anggota</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Field yang dipilih: <span className="font-medium">{selectedFields.length}</span> dari {fieldConfigs.length} field
                </p>
                {totalCount !== undefined && totalCount > data.length && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total data sesuai filter: <span className="font-medium text-primary">{totalCount}</span> anggota
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={exporting}
                >
                  Pilih Semua
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={exporting}
                >
                  Hapus Semua
                </Button>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 shrink-0">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
              Pilih Jumlah Data yang Akan Diexport
            </h4>
            <RadioGroup value={exportOption} onValueChange={(value: any) => setExportOption(value)} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="current" id="current" disabled={exporting} />
                <Label htmlFor="current" className="text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                  Data di halaman ini saja ({data.length} data)
                </Label>
              </div>
              {onFetchAllData && (
                <>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" disabled={exporting} />
                    <Label htmlFor="all" className="text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                      Semua data sesuai filter
                      {totalCount !== undefined && ` (${totalCount} data)`}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" disabled={exporting} />
                    <Label htmlFor="custom" className="text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                      Jumlah tertentu:
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max={totalCount || data.length}
                      value={customLimitInput}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setCustomLimitInput(e.target.value);
                        if (!isNaN(value) && value > 0) {
                          setCustomLimit(value);
                        }
                      }}
                      onFocus={() => setExportOption('custom')}
                      disabled={exporting || exportOption !== 'custom'}
                      className="h-8 w-32"
                    />
                    <span className="text-xs text-blue-700 dark:text-blue-300">data teratas</span>
                  </div>
                </>
              )}
            </RadioGroup>
          </div>

          {/* Required Fields Info */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 shrink-0">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">Field Wajib (Tidak bisa diubah)</p>
                <p className="text-blue-700 dark:text-blue-300">
                  NIK, Nama Anggota, dan Nama Cabang harus selalu ada dalam export untuk identifikasi data.
                </p>
              </div>
            </div>
          </div>

          {/* Field Selection — scrollable area */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-2">
            <div className="space-y-4">
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground sticky top-0 bg-background py-1 z-10">
                    {category}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {fields.map((field) => (
                      <div
                        key={field.key}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          field.required
                            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                            : selectedFields.includes(field.key)
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-muted/30 border-muted'
                        }`}
                      >
                        <Checkbox
                          id={`field-${field.key}`}
                          checked={selectedFields.includes(field.key)}
                          onCheckedChange={() => handleFieldToggle(field.key)}
                          disabled={field.required || exporting}
                        />
                        <label
                          htmlFor={`field-${field.key}`}
                          className={`text-sm cursor-pointer flex-1 flex items-center justify-between gap-2 ${
                            field.required ? 'font-medium' : ''
                          }`}
                        >
                          <span className="truncate">{field.label}</span>
                          {field.required && (
                            <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4">
                              Wajib
                            </Badge>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={exporting}>
              Batal
            </Button>
          </DialogClose>
          <Button
            onClick={handleExport}
            disabled={data.length === 0 || selectedFields.length === 0 || exporting}
          >
            {exporting ? (
              <>
                <Download className="h-4 w-4 mr-2 animate-bounce" />
                Menexport...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
