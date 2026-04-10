import { useState } from 'react';
import { ChevronDown, ChevronRight, Users, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNikInheritance } from '@/lib/hooks/use-nik-inheritance';
import { Anggota } from '@/lib/supabase';

interface ExpandableRowProps {
  anggota: Anggota;
  columns: any[];
  index: number;
  pageSize: number;
  pageIndex: number;
  children?: React.ReactNode;
}

export function ExpandableRow({
  anggota,
  columns,
  index,
  pageSize,
  pageIndex,
  children
}: ExpandableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: inheritanceData, isLoading } = useNikInheritance(anggota.id);

  const hasInheritance = inheritanceData?.data && inheritanceData.data.length > 0;

  return (
    <>
      {/* Main Row */}
      <tr
        className={`hover:bg-muted/50 cursor-pointer ${isExpanded ? 'bg-muted/30' : ''}`}
        onClick={() => hasInheritance && setIsExpanded(!isExpanded)}
      >
        {children}
        {hasInheritance && (
          <td className="px-3 py-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </td>
        )}
      </tr>

      {/* Expanded Row - Inheritance Details */}
      {isExpanded && hasInheritance && (
        <tr className="bg-muted/20">
          <td colSpan={columns.length + 1} className="px-3 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>Riwayat Pewarisan NIK</span>
                <Badge variant="success" appearance="ghost" className="text-xs">
                  {inheritanceData.data.length} Warisan
                </Badge>
              </div>

              <div className="space-y-2">
                {inheritanceData.data.map((inheritance: any) => (
                  <div
                    key={inheritance.id}
                    className="border rounded-lg p-3 bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      {/* NIK */}
                      <div>
                        <span className="text-muted-foreground text-xs">NIK</span>
                        <p className="font-mono font-medium">{inheritance.nik_master.nik}</p>
                      </div>

                      {/* Nama Ahli Waris */}
                      <div>
                        <span className="text-muted-foreground text-xs">Nama Ahli Waris</span>
                        <p className="font-medium">
                          {inheritance.anggota_id || '-'}
                        </p>
                      </div>

                      {/* Hubungan */}
                      <div>
                        <span className="text-muted-foreground text-xs">Hubungan</span>
                        <p className="font-medium capitalize">
                          {inheritance.hubungan || '-'}
                        </p>
                      </div>

                      {/* Status */}
                      <div>
                        <span className="text-muted-foreground text-xs">Status</span>
                        <div>
                          {inheritance.is_current ? (
                            <Badge variant="success" appearance="ghost" className="text-xs">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="secondary" appearance="ghost" className="text-xs">
                              Non-Aktif
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Periode */}
                      <div className="lg:col-span-2">
                        <span className="text-muted-foreground text-xs">Periode</span>
                        <p className="font-medium">
                          {new Date(inheritance.tanggal_mulai).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                          {inheritance.tanggal_selesai && ' - '}
                          {inheritance.tanggal_selesai
                            ? new Date(inheritance.tanggal_selesai).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : 'Sekarang'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info */}
              <p className="text-xs text-muted-foreground">
                <FileText className="h-3 w-3 inline mr-1" />
                NIK ini diwariskan dari pensiunan asli dan tetap sama tidak berubah.
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
