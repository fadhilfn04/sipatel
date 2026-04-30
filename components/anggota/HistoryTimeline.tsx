import { Clock, User, FileText, Trash2, Edit, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HistoryUser {
  id: string;
  email: string;
  full_name: string;
}

interface AnggotaHistoryRecord {
  id: string;
  anggota_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changed_by: string;
  changed_data: any;
  previous_data: any;
  changed_fields: string[];
  created_at: string;
  changed_by_user: HistoryUser | null;
}

interface HistoryTimelineProps {
  history: AnggotaHistoryRecord[];
  isLoading?: boolean;
}

export function HistoryTimeline({ history, isLoading }: HistoryTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse" />
          <p>Memuat riwayat...</p>
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Tidak ada riwayat perubahan yang ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      {/* Timeline items */}
      <div className="space-y-6">
        {history.map((record, index) => (
          <div key={record.id} className="relative pl-10">
            {/* Timeline dot */}
            <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 ${
              getActionColor(record.action)
            }`} />

            {/* History card */}
            <HistoryCard record={record} />
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ record }: { record: AnggotaHistoryRecord }) {
  const actionConfig = getActionConfig(record.action);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left side */}
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            {actionConfig.icon}
            <span className="font-medium">{actionConfig.label}</span>
            <Badge variant={actionConfig.variant as any} appearance="ghost" className="text-xs">
              {record.action}
            </Badge>
          </div>

          {/* Changed fields */}
          {record.changed_fields && record.changed_fields.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {record.changed_fields.map(field => (
                <Badge key={field} variant="secondary" appearance="ghost" className="text-xs">
                  {field}
                </Badge>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(record.created_at)}</span>
            </div>
            {record.changed_by_user && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{record.changed_by_user.full_name || record.changed_by_user.email}</span>
              </div>
            )}
          </div>

          {/* Data preview */}
          {(record.action === 'UPDATE' || record.action === 'DELETE') && record.previous_data && (
            <DataPreview
              previousData={record.previous_data}
              newData={record.changed_data}
              action={record.action}
            />
          )}
        </div>

        {/* Right side - view details */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <FileText className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Lihat detail perubahan</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </Card>
  );
}

function DataPreview({
  previousData,
  newData,
  action
}: {
  previousData: any;
  newData: any;
  action: string;
}) {
  const fieldsToShow = ['nama_anggota', 'nik', 'nama_cabang', 'status_anggota', 'kategori_anggota'];

  return (
    <div className="space-y-2 text-xs">
      <p className="font-medium text-muted-foreground">Perubahan Data:</p>
      <div className="grid grid-cols-2 gap-2">
        {fieldsToShow.map(field => {
          const oldValue = previousData[field];
          const newValue = newData[field];

          if (oldValue === newValue) return null;

          return (
            <div key={field} className="p-2 bg-muted rounded">
              <div className="font-medium mb-1">{formatFieldName(field)}</div>
              <div className="space-y-1">
                {action === 'UPDATE' && (
                  <div className="text-red-600">
                    {oldValue || '-'}
                  </div>
                )}
                <div className="text-green-600">
                  {newValue || '-'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getActionConfig(action: string) {
  const configs = {
    CREATE: {
      label: 'Anggota Baru Dibuat',
      variant: 'success',
      icon: <PlusCircle className="h-4 w-4 text-green-600" />,
      color: 'bg-green-600 border-green-600'
    },
    UPDATE: {
      label: 'Data Diperbarui',
      variant: 'warning',
      icon: <Edit className="h-4 w-4 text-yellow-600" />,
      color: 'bg-yellow-600 border-yellow-600'
    },
    DELETE: {
      label: 'Anggota Dihapus',
      variant: 'destructive',
      icon: <Trash2 className="h-4 w-4 text-red-600" />,
      color: 'bg-red-600 border-red-600'
    }
  };

  return configs[action as keyof typeof configs] || configs.CREATE;
}

function getActionColor(action: string): string {
  const config = getActionConfig(action);
  return config.color;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    nama_anggota: 'Nama Anggota',
    nik: 'NIK',
    nama_cabang: 'Cabang',
    status_anggota: 'Status',
    kategori_anggota: 'Kategori'
  };

  return fieldNames[field] || field;
}